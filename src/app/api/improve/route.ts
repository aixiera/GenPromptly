import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { optimizePromptWithMeta } from "../../../lib/ai/optimizer";
import { error, success } from "../../../lib/api/response";
import { HttpError } from "../../../lib/api/httpError";
import { logUnhandledApiError, toInfraHttpError } from "../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../lib/auth/server";
import { requirePermission } from "../../../lib/rbac";
import { getRequestAuditContext, logAuditEvent } from "../../../lib/audit";
import { estimateModelCostUsd, isOpenAiConfigured } from "../../../lib/config/runtime";
import { enforceRateLimit, enforceRequestBodyLimit } from "../../../lib/security/rateLimit";

export const runtime = "nodejs";

const VALID_MODES = new Set(["clarity", "structure", "detail"]);

function toCount(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export async function POST(req: Request) {
  const bodyTooLarge = enforceRequestBodyLimit(req, 48_000, "api.improve.post");
  if (bodyTooLarge) {
    return bodyTooLarge;
  }

  try {
    const ctx = await requireAuthContext(req);
    requirePermission(ctx, "optimize_prompt");
    const rateLimitDecision = await enforceRateLimit(
      req,
      "improveCostly",
      {
        userId: ctx.userId,
        orgId: ctx.orgId,
        action: "improve",
      },
      "api.improve.post"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }
    try {

      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
      }

      const body = typeof payload === "object" && payload !== null ? payload : {};
      const prompt = "prompt" in body ? (body as Record<string, unknown>).prompt : undefined;
      const mode = "mode" in body ? (body as Record<string, unknown>).mode : undefined;

      const text = String(prompt ?? "").trim();
      const m = String(mode ?? "clarity").trim();
      const auditCtx = getRequestAuditContext(req);

      if (!isOpenAiConfigured()) {
        return NextResponse.json(error("SERVICE_UNAVAILABLE", "Optimizer is not configured yet"), { status: 503 });
      }
      if (!text) {
        return NextResponse.json(error("VALIDATION_ERROR", "Prompt is empty"), { status: 400 });
      }
      if (text.length > 8000) {
        return NextResponse.json(error("VALIDATION_ERROR", "Prompt too long (max 8000 chars)"), { status: 400 });
      }
      if (!VALID_MODES.has(m)) {
        return NextResponse.json(error("VALIDATION_ERROR", "Invalid mode"), { status: 400 });
      }

      const run = await optimizePromptWithMeta(text, m);
      const tokenIn = toCount(run.tokenIn);
      const tokenOut = toCount(run.tokenOut);
      const requestId = crypto.randomUUID();

      await prisma.$transaction(async (tx) => {
        await tx.usage.create({
          data: {
            orgId: ctx.orgId,
            userId: ctx.userId,
            model: run.model,
            tokenIn,
            tokenOut,
            costUsd: estimateModelCostUsd(tokenIn, tokenOut),
            requestId,
            templateName: null,
          },
        });

        await logAuditEvent(tx, {
          orgId: ctx.orgId,
          userId: ctx.userId,
          action: "IMPROVE_PROMPT_TEXT",
          resourceType: "ImproveRequest",
          resourceId: requestId,
          metadata: {
            mode: m,
            inputLength: text.length,
            model: run.model,
            tokenIn,
            tokenOut,
          },
          ...auditCtx,
        });
      });

      return NextResponse.json(
        success({
          result: run.result.optimizedPrompt,
          requestId,
        }),
        { status: 200 }
      );
    } finally {
      rateLimitDecision.release?.();
    }
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.improve.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.improve.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to improve prompt"), { status: 500 });
  }
}
