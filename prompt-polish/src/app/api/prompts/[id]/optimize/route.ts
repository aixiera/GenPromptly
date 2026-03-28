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
import { FREE_OPTIMIZE_LIMIT, UPGRADE_REQUIRED_CODE, UPGRADE_REQUIRED_MESSAGE } from "../../../../../lib/billing/constants";
import { consumeFreeOptimizeQuotaIfAvailable, getOptimizeAccessDecision } from "../../../../../lib/billing/plan";
import {
  OptimizePromptRequestSchema,
  OptimizePromptResponseDataSchema,
} from "../../../../../lib/api/contracts/optimize";
import {
  DEFAULT_SKILL_KEY,
  getSkillDefinition,
  mapLegacyModeToSkillKey,
  resolveToolWorkflow,
} from "../../../../../lib/tools/toolRegistry";

export const runtime = "nodejs";

const FALLBACK_MODEL_NAME = "gpt-4.1-mini";
const SLOW_REQUEST_THRESHOLD_MS = 3_000;
const IS_DEV = process.env.NODE_ENV !== "production";

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

function withRequestId(details: unknown, requestId: string): Record<string, unknown> {
  if (typeof details === "object" && details !== null && !Array.isArray(details)) {
    return {
      ...(details as Record<string, unknown>),
      requestId,
    };
  }

  if (details === undefined) {
    return { requestId };
  }

  return { requestId, details };
}

function logOptimizeEvent(level: "info" | "warn" | "error", event: string, details: Record<string, unknown>): void {
  const payload = {
    event,
    ...details,
  };

  if (level === "info") {
    if (IS_DEV) {
      console.info("Optimize route", payload);
    }
    return;
  }

  if (level === "warn") {
    console.warn("Optimize route warning", payload);
    return;
  }

  console.error("Optimize route error", payload);
}

function logOptimizeResponse(status: number, code: string, requestId: string, details?: Record<string, unknown>): void {
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  logOptimizeEvent(level, "optimize.response", {
    requestId,
    status,
    code,
    ...(details ?? {}),
  });
}

export async function POST(req: Request, ctx: RouteContext) {
  const startedAt = Date.now();
  const routeRequestId = crypto.randomUUID();

  const { id } = await ctx.params;
  logOptimizeEvent("info", "optimize.route.entered", {
    requestId: routeRequestId,
    promptId: typeof id === "string" ? id : null,
  });
  const parsedId = parsePromptId(id);
  if (!parsedId.success) {
    logOptimizeResponse(400, "VALIDATION_ERROR", routeRequestId, { stage: "prompt_id" });
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid prompt id", withRequestId(parsedId.error.flatten(), routeRequestId)), {
      status: 400,
    });
  }
  const bodyTooLarge = enforceRequestBodyLimit(req, 64_000, "api.prompts.optimize.post");
  if (bodyTooLarge) {
    logOptimizeResponse(413, "PAYLOAD_TOO_LARGE", routeRequestId);
    return bodyTooLarge;
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    logOptimizeResponse(400, "BAD_REQUEST", routeRequestId, { stage: "request_json_parse" });
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsedBody = OptimizePromptRequestSchema.safeParse(payload);
  if (!parsedBody.success) {
    logOptimizeResponse(400, "VALIDATION_ERROR", routeRequestId, { stage: "request_body" });
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid request body", withRequestId(parsedBody.error.flatten(), routeRequestId)), {
      status: 400,
    });
  }

  const sanitizedGoal = parsedBody.data.goal ? sanitizeText(parsedBody.data.goal) : undefined;

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "optimize_prompt");
    const auditCtx = getRequestAuditContext(req);
    logOptimizeEvent("info", "optimize.request.accepted", {
      requestId: routeRequestId,
      orgId: auth.orgId,
      userId: auth.userId,
      promptId: parsedId.data,
      requestedMode: parsedBody.data.mode ?? null,
      requestedSkillKey: parsedBody.data.skillKey ?? null,
      hasGoal: Boolean(sanitizedGoal),
    });
    const optimizeAccess = await getOptimizeAccessDecision(auth.userId);
    if (!optimizeAccess.allowOptimize) {
      logOptimizeEvent("warn", "optimize.quota.blocked", {
        requestId: routeRequestId,
        userId: auth.userId,
        freeOptimizeUsed: optimizeAccess.freeOptimizeUsed,
        freeOptimizeRemaining: optimizeAccess.freeOptimizeRemaining,
      });
      logOptimizeResponse(402, UPGRADE_REQUIRED_CODE, routeRequestId);
      return NextResponse.json(
        error(UPGRADE_REQUIRED_CODE, UPGRADE_REQUIRED_MESSAGE, {
          requestId: routeRequestId,
          freeOptimizeLimit: FREE_OPTIMIZE_LIMIT,
          freeOptimizeUsed: optimizeAccess.freeOptimizeUsed,
          freeOptimizeRemaining: optimizeAccess.freeOptimizeRemaining,
        }),
        { status: 402 }
      );
    }
    logOptimizeEvent("info", "optimize.quota.passed", {
      requestId: routeRequestId,
      userId: auth.userId,
      isPlusActive: optimizeAccess.isPlusActive,
      freeOptimizeRemaining: optimizeAccess.freeOptimizeRemaining,
    });
    if (!isOpenAiConfigured()) {
      logOptimizeResponse(503, "SERVICE_UNAVAILABLE", routeRequestId, { stage: "openai_not_configured" });
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
      logOptimizeResponse(429, "RATE_LIMITED", routeRequestId, { stage: "rate_limit" });
      return rateLimitDecision.response;
    }
    try {

      const prompt = await getPromptForOptimize(auth.orgId, parsedId.data);
      if (!prompt) {
        logOptimizeResponse(404, "NOT_FOUND", routeRequestId, { stage: "prompt_lookup" });
        return NextResponse.json(error("NOT_FOUND", "Prompt not found"), { status: 404 });
      }

      if (prompt.templateId && !prompt.template) {
        logOptimizeResponse(404, "NOT_FOUND", routeRequestId, { stage: "template_lookup" });
        return NextResponse.json(error("NOT_FOUND", "Template not found"), { status: 404 });
      }

      const sanitizedRawPrompt = sanitizeText(prompt.rawPrompt);
      if (!sanitizedRawPrompt) {
        logOptimizeResponse(400, "VALIDATION_ERROR", routeRequestId, { stage: "prompt_content_empty" });
        return NextResponse.json(error("VALIDATION_ERROR", "Prompt text is empty and cannot be optimized"), {
          status: 400,
        });
      }
      if (sanitizedRawPrompt.length > 8000) {
        logOptimizeResponse(400, "VALIDATION_ERROR", routeRequestId, { stage: "prompt_content_too_long" });
        return NextResponse.json(error("VALIDATION_ERROR", "Prompt text exceeds 8000 characters"), {
          status: 400,
        });
      }
      logOptimizeEvent("info", "optimize.user_prompt.validated", {
        requestId: routeRequestId,
        orgId: auth.orgId,
        userId: auth.userId,
        promptId: prompt.id,
        templateKey: prompt.template?.key ?? null,
      });

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

      let firstRun;
      try {
        logOptimizeEvent("info", "optimize.openai.request.started", {
          requestId: routeRequestId,
          promptId: prompt.id,
          mode: optimizerMode,
          attempt: 1,
          retry: false,
        });
        firstRun = await optimizePromptWithMeta(
          sanitizedRawPrompt,
          optimizerMode,
          sanitizedGoal,
          {
            templateSystemPrompt,
            workflow: resolvedWorkflow,
          }
        );
        logOptimizeEvent("info", "optimize.openai.response.parsed", {
          requestId: routeRequestId,
          promptId: prompt.id,
          mode: optimizerMode,
          attempt: 1,
          retry: false,
          model: firstRun.model,
        });
      } catch (openAiError: unknown) {
        logOptimizeEvent("error", "optimize.openai.response.parse_failed", {
          requestId: routeRequestId,
          promptId: prompt.id,
          mode: optimizerMode,
          attempt: 1,
          retry: false,
          reason: openAiError instanceof Error ? openAiError.message : String(openAiError),
        });
        throw openAiError;
      }

      let chosenRun = firstRun;
      const firstValidation = validateOptimizeResult(firstRun.result);

      if (!firstValidation.valid) {
        logOptimizeEvent("warn", "optimize.quality_check.failed", {
          requestId: routeRequestId,
          promptId: prompt.id,
          mode: optimizerMode,
          problems: firstValidation.problems,
        });
        try {
          logOptimizeEvent("info", "optimize.openai.request.started", {
            requestId: routeRequestId,
            promptId: prompt.id,
            mode: optimizerMode,
            attempt: 2,
            retry: true,
          });
          const retryRun = await optimizePromptWithMeta(
            sanitizedRawPrompt,
            optimizerMode,
            buildQualityRetryInstruction(sanitizedGoal, firstValidation.problems),
            {
              templateSystemPrompt,
              workflow: resolvedWorkflow,
            }
          );
          logOptimizeEvent("info", "optimize.openai.response.parsed", {
            requestId: routeRequestId,
            promptId: prompt.id,
            mode: optimizerMode,
            attempt: 2,
            retry: true,
            model: retryRun.model,
          });

          const retryValidation = validateOptimizeResult(retryRun.result);
          if (!retryValidation.valid) {
            logOptimizeEvent("warn", "optimize.quality_retry.failed", {
              requestId: routeRequestId,
              promptId: prompt.id,
              mode: optimizerMode,
              problems: retryValidation.problems,
            });
            chosenRun = {
              ...firstRun,
              result: {
                ...firstRun.result,
                riskFlags: ensureLowQualityFlag(firstRun.result.riskFlags),
              },
            };
          } else {
            logOptimizeEvent("info", "optimize.quality_retry.succeeded", {
              requestId: routeRequestId,
              promptId: prompt.id,
              mode: optimizerMode,
            });
            chosenRun = retryRun;
          }
        } catch (retryError: unknown) {
          logOptimizeEvent("warn", "optimize.retry.unavailable", {
            requestId: routeRequestId,
            promptId: prompt.id,
            mode: optimizerMode,
            reason: retryError instanceof Error ? retryError.message : String(retryError),
          });
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
      const modelName = chosenRun.model || FALLBACK_MODEL_NAME;

      let latestVersion;
      try {
        logOptimizeEvent("info", "optimize.db.write.started", {
          requestId: routeRequestId,
          promptId: prompt.id,
          orgId: auth.orgId,
        });
        latestVersion = await prisma.$transaction(async (tx) => {
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
              requestId: routeRequestId,
              templateName: resolvedWorkflow.templateKey,
            },
          });

          if (!optimizeAccess.isPlusActive) {
            const consumedFreeQuota = await consumeFreeOptimizeQuotaIfAvailable(auth.userId, tx);
            if (!consumedFreeQuota) {
              throw new HttpError(402, UPGRADE_REQUIRED_CODE, UPGRADE_REQUIRED_MESSAGE, {
                freeOptimizeLimit: FREE_OPTIMIZE_LIMIT,
              });
            }
          }

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
              requestId: routeRequestId,
              billingPlan: optimizeAccess.isPlusActive ? "PLUS" : "FREE",
              freeOptimizeUsedBefore: optimizeAccess.freeOptimizeUsed,
              freeOptimizeRemainingBefore: optimizeAccess.freeOptimizeRemaining,
              consumedFreeOptimize: !optimizeAccess.isPlusActive,
            },
            ...auditCtx,
          });

          return createdVersion;
        });
        logOptimizeEvent("info", "optimize.db.write.succeeded", {
          requestId: routeRequestId,
          promptId: prompt.id,
          versionId: latestVersion.id,
        });
      } catch (dbError: unknown) {
        logOptimizeEvent("error", "optimize.db.write.failed", {
          requestId: routeRequestId,
          promptId: prompt.id,
          reason: dbError instanceof Error ? dbError.message : String(dbError),
        });
        throw dbError;
      }

      const responseData = {
        versionId: latestVersion.id,
        promptId: latestVersion.promptId,
        orgId: latestVersion.orgId,
        createdAt: latestVersion.createdAt.toISOString(),
        result: {
          optimizedPrompt: calibratedResult.optimizedPrompt,
          keyChanges: calibratedResult.keyChanges,
          recommendations,
          scores: calibratedResult.scores,
          missingFields: calibratedResult.missingFields,
          riskFlags: calibratedResult.riskFlags,
          structure,
          structuredData,
          skillKey,
          toolKey,
          workflowProfile,
          mode: optimizerMode,
          model: modelName,
        },
      };
      const parsedResponseData = OptimizePromptResponseDataSchema.safeParse(responseData);
      if (!parsedResponseData.success) {
        logOptimizeEvent("error", "optimize.response_contract.invalid", {
          requestId: routeRequestId,
          promptId: prompt.id,
          issues: parsedResponseData.error.flatten(),
        });
        logOptimizeResponse(500, "INTERNAL_ERROR", routeRequestId, { stage: "response_contract" });
        return NextResponse.json(
          error("INTERNAL_ERROR", "Optimize response contract mismatch", { requestId: routeRequestId }),
          { status: 500 }
        );
      }

      const optimizeDurationMs = Date.now() - startedAt;
      logSlowIfNeeded(optimizeDurationMs, {
        promptId: prompt.id,
        model: modelName,
        orgId: auth.orgId,
      });
      logOptimizeEvent("info", "optimize.completed", {
        requestId: routeRequestId,
        promptId: prompt.id,
        orgId: auth.orgId,
        versionId: latestVersion.id,
        model: modelName,
        optimizeDurationMs,
      });
      logOptimizeResponse(201, "OK", routeRequestId, { promptId: prompt.id, versionId: latestVersion.id });

      return NextResponse.json(success(parsedResponseData.data), { status: 201 });
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
        logOptimizeEvent("error", "optimize.output_invalid", {
          requestId: routeRequestId,
          promptId: parsedId.data,
          details: err.details ?? null,
        });
        logOptimizeResponse(502, "OPTIMIZER_OUTPUT_INVALID", routeRequestId);
        return NextResponse.json(
          error(
            "OPTIMIZER_OUTPUT_INVALID",
            "Optimizer returned invalid structured output. Please retry.",
            withRequestId(IS_DEV ? err.details : undefined, routeRequestId)
          ),
          { status: 502 }
        );
      }
      logOptimizeResponse(err.status, err.code, routeRequestId);
      return NextResponse.json(error(err.code, err.message, withRequestId(err.details, routeRequestId)), {
        status: err.status,
      });
    }
    const infraError = toInfraHttpError(err, "api.prompts.optimize.post");
    if (infraError) {
      logOptimizeResponse(infraError.status, infraError.code, routeRequestId);
      return NextResponse.json(error(infraError.code, infraError.message, withRequestId(infraError.details, routeRequestId)), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.prompts.optimize.post", err);
    logOptimizeResponse(500, "INTERNAL_ERROR", routeRequestId);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to optimize prompt", { requestId: routeRequestId }), {
      status: 500,
    });
  }
}
