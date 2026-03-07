import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../../../../lib/db";
import { error, success } from "../../../../../lib/api/response";
import { HttpError, InternalError } from "../../../../../lib/api/httpError";
import { logUnhandledApiError, toInfraHttpError } from "../../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../../lib/auth/server";
import { optimizePromptWithMeta } from "../../../../../lib/ai/optimizer";
import { validateOptimizeResult } from "../../../../../lib/promptQualityGuard";
import { calibrateScores } from "../../../../../lib/promptScoreCalibration";
import { getPromptForOptimize } from "../../../../../lib/tenantData";
import { getRequestAuditContext, logAuditEvent } from "../../../../../lib/audit";
import { requirePermission } from "../../../../../lib/rbac";
import { estimateModelCostUsd, isOpenAiConfigured } from "../../../../../lib/config/runtime";
import { enforceRateLimit, enforceRequestBodyLimit } from "../../../../../lib/security/rateLimit";
import {
  DEFAULT_SKILL_KEY,
  OPTIMIZATION_PROFILES,
  SkillKeySchema,
  getSkillDefinition,
  mapLegacyModeToSkillKey,
  resolveToolWorkflow,
} from "../../../../../lib/tools/toolRegistry";

export const runtime = "nodejs";

const FALLBACK_MODEL_NAME = "gpt-4.1-mini";
const SLOW_REQUEST_THRESHOLD_MS = 3_000;

const OptimizeModeSchema = z.enum(OPTIMIZATION_PROFILES);

const OptimizeRequestSchema = z
  .object({
    mode: OptimizeModeSchema.optional(),
    skillKey: SkillKeySchema.optional(),
    goal: z.string().trim().min(1, "goal cannot be empty").max(1200, "goal is too long").optional(),
  })
  .strict();

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

function parsePromptId(id: string) {
  return z.string().trim().min(1, "id is required").max(120, "id is too long").safeParse(id);
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
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

function toCount(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function POST(req: Request, ctx: RouteContext) {
  const startedAt = Date.now();

  const { id } = await ctx.params;
  const parsedId = parsePromptId(id);
  if (!parsedId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid prompt id", parsedId.error.flatten()), {
      status: 400,
    });
  }
  const bodyTooLarge = enforceRequestBodyLimit(req, 64_000, "api.prompts.optimize.post");
  if (bodyTooLarge) {
    return bodyTooLarge;
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsedBody = OptimizeRequestSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten()), {
      status: 400,
    });
  }

  const sanitizedGoal = parsedBody.data.goal ? sanitizeText(parsedBody.data.goal) : undefined;

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "optimize_prompt");
    const auditCtx = getRequestAuditContext(req);
    if (!isOpenAiConfigured()) {
      return NextResponse.json(error("SERVICE_UNAVAILABLE", "Optimizer is not configured yet"), { status: 503 });
    }
    const rateLimitDecision = await enforceRateLimit(
      req,
      "optimizeCostly",
      {
        userId: auth.userId,
        orgId: auth.orgId,
        action: parsedBody.data.skillKey ?? parsedBody.data.mode ?? "optimize",
      },
      "api.prompts.optimize.post"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }
    try {

      const prompt = await getPromptForOptimize(auth.orgId, parsedId.data);
      if (!prompt) {
        return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
      }

      if (prompt.templateId && !prompt.template) {
        return NextResponse.json(error("NOT_FOUND", "Template not found"), { status: 404 });
      }

      const sanitizedRawPrompt = sanitizeText(prompt.rawPrompt);
      if (!sanitizedRawPrompt) {
        return NextResponse.json(error("VALIDATION_ERROR", "Prompt text is empty and cannot be optimized"), {
          status: 400,
        });
      }
      if (sanitizedRawPrompt.length > 8000) {
        return NextResponse.json(error("VALIDATION_ERROR", "Prompt text exceeds 8000 characters"), {
          status: 400,
        });
      }

      const templateSystemPrompt = prompt.template?.systemPrompt
        ? sanitizeText(prompt.template.systemPrompt)
        : undefined;

      const explicitSkillKey = parsedBody.data.skillKey ?? mapLegacyModeToSkillKey(parsedBody.data.mode ?? null);
      const workflow = resolveToolWorkflow({
        skillKey: explicitSkillKey,
        templateKey: prompt.template?.key ?? null,
        profile: parsedBody.data.mode ?? null,
      });
      const fallbackWorkflow = getSkillDefinition(DEFAULT_SKILL_KEY);
      const resolvedWorkflow = workflow ?? fallbackWorkflow;
      if (!resolvedWorkflow) {
        return NextResponse.json(error("INTERNAL_ERROR", "No skill workflow is configured"), { status: 500 });
      }
      if (parsedBody.data.mode && parsedBody.data.mode !== resolvedWorkflow.defaultOptimizationProfile) {
        console.warn("Optimize request mode remapped to workflow default profile", {
          requestedMode: parsedBody.data.mode,
          resolvedMode: resolvedWorkflow.defaultOptimizationProfile,
          skillKey: resolvedWorkflow.skillKey,
        });
      }
      const optimizerMode = resolvedWorkflow.defaultOptimizationProfile;

      const firstRun = await optimizePromptWithMeta(
        sanitizedRawPrompt,
        optimizerMode,
        sanitizedGoal,
        {
          templateSystemPrompt,
          workflow: resolvedWorkflow,
        }
      );

      let chosenRun = firstRun;
      const firstValidation = validateOptimizeResult(firstRun.result);

      if (!firstValidation.valid) {
        try {
          const retryRun = await optimizePromptWithMeta(
            sanitizedRawPrompt,
            optimizerMode,
            buildQualityRetryInstruction(sanitizedGoal, firstValidation.problems),
            {
              templateSystemPrompt,
              workflow: resolvedWorkflow,
            }
          );

          const retryValidation = validateOptimizeResult(retryRun.result);
          if (!retryValidation.valid) {
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
        } catch {
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
      const recommendations = toStringArray(chosenRun.result.recommendations).slice(0, 20);
      const structure = toRecord(chosenRun.result.structure);
      const structuredData = toRecord(chosenRun.result.structuredData);
      const skillKey = resolvedWorkflow.skillKey;
      const toolKey = resolvedWorkflow.toolKey;
      const workflowProfile = resolvedWorkflow.workflowProfile;

      const tokenIn = toCount(chosenRun.tokenIn);
      const tokenOut = toCount(chosenRun.tokenOut);
      const requestId = crypto.randomUUID();
      const modelName = chosenRun.model || FALLBACK_MODEL_NAME;

      const latestVersion = await prisma.$transaction(async (tx) => {
        const createdVersion = await tx.promptVersion.create({
          data: {
            promptId: prompt.id,
            orgId: auth.orgId,
            optimizedPrompt: calibratedResult.optimizedPrompt,
            keyChanges: calibratedResult.keyChanges,
            scores: calibratedResult.scores,
            missingFields: calibratedResult.missingFields,
            riskFlags: calibratedResult.riskFlags,
            rawInputPrompt: prompt.rawPrompt,
            mode: optimizerMode,
            model: modelName,
            tokenIn,
            tokenOut,
          },
        });

        const usage = await tx.usage.create({
          data: {
            orgId: auth.orgId,
            userId: auth.userId,
            model: modelName,
            tokenIn,
            tokenOut,
            costUsd: estimateModelCostUsd(tokenIn, tokenOut),
            requestId,
            templateName: resolvedWorkflow.templateKey,
          },
        });

        await logAuditEvent(tx, {
          orgId: auth.orgId,
          userId: auth.userId,
          action: "OPTIMIZE_PROMPT",
          resourceType: "PromptVersion",
          resourceId: createdVersion.id,
          metadata: {
            projectId: prompt.projectId,
            promptId: prompt.id,
            requestedMode: parsedBody.data.mode ?? null,
            mode: optimizerMode,
            skillKey,
            goal: sanitizedGoal ?? null,
            templateName: resolvedWorkflow.templateKey,
            templateVersion: prompt.template?.updatedAt?.toISOString() ?? null,
            toolKey,
            workflowProfile,
            recommendations,
            structure: structure as Prisma.InputJsonValue,
            structuredData: structuredData as Prisma.InputJsonValue,
            model: modelName,
            scores: calibratedResult.scores,
            riskFlags: calibratedResult.riskFlags,
            usageId: usage.id,
            tokenIn,
            tokenOut,
            requestId,
          },
          ...auditCtx,
        });

        return createdVersion;
      });

      const optimizeDurationMs = Date.now() - startedAt;
      logSlowIfNeeded(optimizeDurationMs, {
        promptId: prompt.id,
        model: modelName,
        orgId: auth.orgId,
      });

      return NextResponse.json(
        success({
          ...latestVersion,
          recommendations,
          structure,
          structuredData,
          skillKey,
          toolKey,
          workflowProfile,
        }),
        { status: 201 }
      );
    } finally {
      rateLimitDecision.release?.();
    }
  } catch (err: unknown) {
    const optimizeDurationMs = Date.now() - startedAt;
    logSlowIfNeeded(optimizeDurationMs, {
      promptId: parsedId.data,
      failed: true,
    });

    if (err instanceof HttpError) {
      if (err instanceof InternalError && err.code === "INVALID_OPTIMIZER_OUTPUT") {
        console.error("Optimizer output validation failed", {
          promptId: parsedId.data,
          details: err.details,
        });
        return NextResponse.json(
          error("OPTIMIZER_OUTPUT_INVALID", "Optimizer returned invalid output. Please retry."),
          { status: 502 }
        );
      }
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.prompts.optimize.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.prompts.optimize.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to optimize prompt"), { status: 500 });
  }
}
