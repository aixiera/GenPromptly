import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../lib/db";
import { error, success } from "../../../../../lib/api/response";
import { HttpError } from "../../../../../lib/api/httpError";
import { optimizePromptWithMeta } from "../../../../../lib/ai/optimizer";
import { validateOptimizeResult } from "../../../../../lib/promptQualityGuard";
import { calibrateScores } from "../../../../../lib/promptScoreCalibration";
import { optimizeRateLimiter } from "../../../../../lib/rateLimit";

export const runtime = "nodejs";

const FALLBACK_MODEL_NAME = "gpt-4.1-mini";
const SLOW_REQUEST_THRESHOLD_MS = 3_000;

const OptimizeModeSchema = z.enum([
  "clarity",
  "structure",
  "detail",
  "general",
  "marketing",
  "healthcare",
  "finance",
  "legal",
]);

const OptimizeRequestSchema = z
  .object({
    mode: OptimizeModeSchema.default("general"),
    goal: z.string().trim().min(1, "goal cannot be empty").max(1200, "goal is too long").optional(),
  })
  .strict();

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

type PromptSelection = {
  id: string;
  rawPrompt: string;
  templateId: string | null;
  template: { id: string; key: string; systemPrompt: string } | null;
};

function parsePromptId(id: string) {
  return z.string().trim().min(1, "id is required").max(120, "id is too long").safeParse(id);
}

function mapToOptimizerMode(mode: z.infer<typeof OptimizeModeSchema>): "clarity" | "structure" | "detail" {
  if (mode === "clarity" || mode === "structure" || mode === "detail") {
    return mode;
  }

  if (mode === "marketing" || mode === "finance") {
    return "structure";
  }

  if (mode === "healthcare" || mode === "legal") {
    return "detail";
  }

  return "clarity";
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getRequestActorKey(req: Request): string {
  const userHeader = req.headers.get("x-user-id")?.trim();
  if (userHeader) {
    return `user:${userHeader}`;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return `ip:${first}`;
    }
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return `ip:${realIp}`;
  }

  return "ip:unknown";
}

function ensureLowQualityFlag(riskFlags: string[]): string[] {
  if (riskFlags.includes("low_quality_generation")) {
    return riskFlags;
  }

  return [...riskFlags, "low_quality_generation"];
}

function logSlowIfNeeded(durationMs: number, details: Record<string, unknown>) {
  if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
    console.warn("Slow optimize request", { optimizeDurationMs: durationMs, ...details });
  }
}

function buildQualityRetryInstruction(goal: string | undefined, problems: string[]): string {
  const qualityInstruction = `The previous output failed quality checks: ${problems.join(
    "; "
  )}. Generate a higher-quality structured output.`;

  return [goal, qualityInstruction]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n\n");
}

export async function POST(req: Request, ctx: RouteContext) {
  const startedAt = Date.now();
  const actorKey = getRequestActorKey(req);

  const { id } = await ctx.params;
  const parsedId = parsePromptId(id);
  if (!parsedId.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid prompt id", parsedId.error.flatten()),
      { status: 400 }
    );
  }

  const rate = optimizeRateLimiter.check(actorKey);
  if (!rate.allowed) {
    return NextResponse.json(
      error("RATE_LIMITED", "Too many optimize requests", {
        limit: rate.limit,
        burstLimit: 10,
        windowSeconds: 60,
        retryAfterSeconds: rate.retryAfterSeconds,
        reason: rate.reason,
      }),
      { status: 429 }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsedBody = OptimizeRequestSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten()),
      { status: 400 }
    );
  }

  const sanitizedGoal = parsedBody.data.goal ? sanitizeText(parsedBody.data.goal) : undefined;
  const optimizerMode = mapToOptimizerMode(parsedBody.data.mode);

  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        rawPrompt: true,
        templateId: true,
        template: {
          select: {
            id: true,
            key: true,
            systemPrompt: true,
          },
        },
      },
    });

    if (!prompt) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    const selectedPrompt = prompt as PromptSelection;
    if (selectedPrompt.templateId && !selectedPrompt.template) {
      return NextResponse.json(error("NOT_FOUND", "Template not found"), { status: 404 });
    }

    const sanitizedRawPrompt = sanitizeText(selectedPrompt.rawPrompt);
    if (!sanitizedRawPrompt) {
      return NextResponse.json(
        error("VALIDATION_ERROR", "Prompt text is empty and cannot be optimized"),
        { status: 400 }
      );
    }
    if (sanitizedRawPrompt.length > 8000) {
      return NextResponse.json(
        error("VALIDATION_ERROR", "Prompt text exceeds 8000 characters"),
        { status: 400 }
      );
    }

    const sanitizedTemplateSystemPrompt = selectedPrompt.template?.systemPrompt
      ? sanitizeText(selectedPrompt.template.systemPrompt)
      : undefined;

    console.info("optimize started", {
      promptId: selectedPrompt.id,
      mode: parsedBody.data.mode,
      optimizerMode,
      templateUsed: selectedPrompt.template?.key ?? null,
      actor: actorKey,
    });
    console.info("template used", {
      promptId: selectedPrompt.id,
      templateUsed: selectedPrompt.template?.key ?? null,
    });

    const firstRun = await optimizePromptWithMeta(
      sanitizedRawPrompt,
      optimizerMode,
      sanitizedGoal,
      sanitizedTemplateSystemPrompt
    );

    let chosenRun = firstRun;
    const firstValidation = validateOptimizeResult(firstRun.result);

    if (!firstValidation.valid) {
      console.warn("Prompt quality guard triggered", firstValidation.problems);
      console.warn("Prompt quality guard retry executed", {
        promptId: selectedPrompt.id,
        templateUsed: selectedPrompt.template?.key ?? null,
      });

      try {
        const retryRun = await optimizePromptWithMeta(
          sanitizedRawPrompt,
          optimizerMode,
          buildQualityRetryInstruction(sanitizedGoal, firstValidation.problems),
          sanitizedTemplateSystemPrompt
        );

        const retryValidation = validateOptimizeResult(retryRun.result);
        if (!retryValidation.valid) {
          console.warn("Prompt quality guard triggered", retryValidation.problems);
          chosenRun = {
            ...firstRun,
            result: {
              ...firstRun.result,
              riskFlags: ensureLowQualityFlag(firstRun.result.riskFlags),
            },
          };
        } else {
          chosenRun = retryRun;
        }
      } catch (retryErr: unknown) {
        console.warn("Prompt quality guard triggered", [
          `retry_failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
        ]);
        chosenRun = {
          ...firstRun,
          result: {
            ...firstRun.result,
            riskFlags: ensureLowQualityFlag(firstRun.result.riskFlags),
          },
        };
      }
    }

    const calibratedResult = {
      ...chosenRun.result,
      scores: calibrateScores(chosenRun.result),
    };

    const latestVersion = await prisma.$transaction(async (tx) => {
      const createdVersion = await tx.promptVersion.create({
        data: {
          promptId: selectedPrompt.id,
          optimizedPrompt: calibratedResult.optimizedPrompt,
          keyChanges: calibratedResult.keyChanges,
          scores: calibratedResult.scores,
          missingFields: calibratedResult.missingFields,
          riskFlags: calibratedResult.riskFlags,
          rawInputPrompt: selectedPrompt.rawPrompt,
          mode: parsedBody.data.mode,
          model: chosenRun.model || FALLBACK_MODEL_NAME,
          tokenIn: chosenRun.tokenIn,
          tokenOut: chosenRun.tokenOut,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "PROMPT_OPTIMIZED",
          entityType: "PromptVersion",
          entityId: createdVersion.id,
          meta: {
            promptId: selectedPrompt.id,
            mode: parsedBody.data.mode,
            goal: sanitizedGoal ?? null,
            actor: actorKey,
            templateUsed: selectedPrompt.template?.key ?? null,
            model: chosenRun.model || FALLBACK_MODEL_NAME,
          },
        },
      });

      return createdVersion;
    });

    const optimizeDurationMs = Date.now() - startedAt;
    console.info("model used", {
      promptId: selectedPrompt.id,
      model: chosenRun.model || FALLBACK_MODEL_NAME,
      tokenIn: chosenRun.tokenIn,
      tokenOut: chosenRun.tokenOut,
      optimizeDurationMs,
    });
    logSlowIfNeeded(optimizeDurationMs, {
      promptId: selectedPrompt.id,
      model: chosenRun.model || FALLBACK_MODEL_NAME,
    });

    return NextResponse.json(success(latestVersion), { status: 201 });
  } catch (err: unknown) {
    const optimizeDurationMs = Date.now() - startedAt;
    console.error("LLM failure", {
      promptId: parsedId.data,
      mode: parsedBody.data.mode,
      optimizeDurationMs,
      message: err instanceof Error ? err.message : String(err),
    });
    logSlowIfNeeded(optimizeDurationMs, {
      promptId: parsedId.data,
      failed: true,
    });

    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }

    return NextResponse.json(error("INTERNAL_ERROR", "Failed to optimize prompt"), { status: 500 });
  }
}
