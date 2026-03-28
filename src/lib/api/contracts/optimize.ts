import { z } from "zod";
import { OPTIMIZATION_PROFILES, SkillKeySchema } from "../../tools/toolRegistry";
import type { PromptVersion } from "../../types";

const NonEmptyStringSchema = z.string().trim().min(1);
const JsonRecordSchema = z.record(z.string(), z.unknown());

export const OptimizePromptRequestSchema = z
  .object({
    mode: z.enum(OPTIMIZATION_PROFILES).optional(),
    skillKey: SkillKeySchema.optional(),
    goal: z.string().trim().min(1, "goal cannot be empty").max(1200, "goal is too long").optional(),
  })
  .strict();

export const OptimizeScoresSchema = z
  .object({
    clarity: z.number().min(0).max(10),
    context: z.number().min(0).max(10),
    constraints: z.number().min(0).max(10),
    format: z.number().min(0).max(10),
  })
  .strict();

export const OptimizePromptResultSchema = z
  .object({
    optimizedPrompt: NonEmptyStringSchema,
    keyChanges: z.array(z.string()),
    recommendations: z.array(z.string()),
    scores: OptimizeScoresSchema,
    missingFields: z.array(z.string()),
    riskFlags: z.array(z.string()),
    structure: JsonRecordSchema,
    structuredData: JsonRecordSchema,
    skillKey: z.string().nullable(),
    toolKey: z.string().nullable(),
    workflowProfile: z.string().nullable(),
    mode: NonEmptyStringSchema,
    model: NonEmptyStringSchema,
  })
  .strict();

export const OptimizePromptResponseDataSchema = z
  .object({
    versionId: NonEmptyStringSchema,
    promptId: NonEmptyStringSchema,
    orgId: NonEmptyStringSchema,
    createdAt: NonEmptyStringSchema,
    result: OptimizePromptResultSchema,
  })
  .strict();

export type OptimizePromptResponseData = z.infer<typeof OptimizePromptResponseDataSchema>;

export function parseOptimizePromptResponseData(value: unknown): OptimizePromptResponseData {
  const parsed = OptimizePromptResponseDataSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const issuePath = issue?.path.join(".") || "response";
    throw new Error(`Optimize API contract mismatch at ${issuePath}: ${issue?.message ?? "invalid payload"}`);
  }
  return parsed.data;
}

export function toPromptVersionFromOptimizeResponse(response: OptimizePromptResponseData): PromptVersion {
  return {
    id: response.versionId,
    promptId: response.promptId,
    orgId: response.orgId,
    optimizedPrompt: response.result.optimizedPrompt,
    keyChanges: response.result.keyChanges,
    recommendations: response.result.recommendations,
    scores: response.result.scores,
    missingFields: response.result.missingFields,
    riskFlags: response.result.riskFlags,
    structure: response.result.structure,
    structuredData: response.result.structuredData,
    skillKey: response.result.skillKey,
    toolKey: response.result.toolKey,
    workflowProfile: response.result.workflowProfile,
    mode: response.result.mode,
    model: response.result.model,
    createdAt: response.createdAt,
  };
}
