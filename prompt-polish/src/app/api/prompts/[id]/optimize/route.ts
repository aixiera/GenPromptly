import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../lib/db";
import { error, success } from "../../../../../lib/api/response";
import { HttpError } from "../../../../../lib/api/httpError";
import { optimizePrompt } from "../../../../../lib/ai/optimizer";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MODEL_NAME = "gpt-4.1-mini";

const requestCounts = new Map<string, { count: number; windowStart: number }>();

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
    goal: z.string().trim().min(1, "goal cannot be empty").max(300, "goal is too long").optional(),
  })
  .strict();

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
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

function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const xRealIp = req.headers.get("x-real-ip")?.trim();
  if (xRealIp) {
    return xRealIp;
  }

  return "unknown";
}

function checkRateLimit(ip: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = requestCounts.get(ip);

  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(ip, { count: 1, windowStart: now });
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - existing.windowStart));
    return { limited: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  existing.count += 1;
  requestCounts.set(ip, existing);
  return { limited: false, retryAfterSeconds: 0 };
}

export async function POST(req: Request, ctx: RouteContext) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);
  if (rate.limited) {
    return NextResponse.json(
      error("RATE_LIMITED", "Too many optimize requests", {
        limit: RATE_LIMIT_MAX_REQUESTS,
        windowSeconds: RATE_LIMIT_WINDOW_MS / 1000,
        retryAfterSeconds: rate.retryAfterSeconds,
      }),
      { status: 429 }
    );
  }

  const { id } = await ctx.params;
  const parsedId = parsePromptId(id);
  if (!parsedId.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid prompt id", parsedId.error.flatten()),
      { status: 400 }
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

  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        rawPrompt: true,
      },
    });

    if (!prompt) {
      return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
    }

    const optimizerMode = mapToOptimizerMode(parsedBody.data.mode);
    const result = await optimizePrompt(prompt.rawPrompt, optimizerMode, parsedBody.data.goal);

    const latestVersion = await prisma.$transaction(async (tx) => {
      const createdVersion = await tx.promptVersion.create({
        data: {
          promptId: prompt.id,
          optimizedPrompt: result.optimizedPrompt,
          keyChanges: result.keyChanges,
          scores: result.scores,
          missingFields: result.missingFields,
          riskFlags: result.riskFlags,
          rawInputPrompt: prompt.rawPrompt,
          mode: parsedBody.data.mode,
          model: MODEL_NAME,
          tokenIn: null,
          tokenOut: null,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "PROMPT_OPTIMIZED",
          entityType: "PromptVersion",
          entityId: createdVersion.id,
          meta: {
            promptId: prompt.id,
            mode: parsedBody.data.mode,
            goal: parsedBody.data.goal ?? null,
            ip,
          },
        },
      });

      return createdVersion;
    });

    return NextResponse.json(success(latestVersion), { status: 201 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }

    return NextResponse.json(error("INTERNAL_ERROR", "Failed to optimize prompt"), { status: 500 });
  }
}
