import OpenAI from "openai";
import { z } from "zod";
import { InternalError } from "../api/httpError";
import { OptimizeResultSchema, type OptimizeResult } from "./schema";
import { getLlmTimeoutMs } from "../config/runtime";
import {
  OPTIMIZATION_PROFILES,
  type OptimizationProfile,
  type ToolWorkflow,
} from "../tools/toolRegistry";

const OptimizeInputSchema = z
  .object({
    rawPrompt: z.string().trim().min(1, "rawPrompt is required").max(8000, "rawPrompt is too long"),
    mode: z.enum(OPTIMIZATION_PROFILES),
    goal: z.string().trim().min(1, "goal cannot be empty").max(1200, "goal is too long").optional(),
  })
  .strict();

export type OptimizeMode = z.infer<typeof OptimizeInputSchema>["mode"];
export type StructuredOptimizeResult = OptimizeResult & {
  recommendations: string[];
  structure: Record<string, unknown>;
  structuredData: Record<string, unknown>;
  skillKey?: string;
  toolKey?: string;
  workflowProfile?: string;
};

type OptimizeRunOptions = {
  templateSystemPrompt?: string;
  workflow?: ToolWorkflow | null;
};

export type OptimizePromptRun = {
  result: StructuredOptimizeResult;
  tokenIn: number | null;
  tokenOut: number | null;
  model: string;
};

const MODE_TO_INSTRUCTIONS: Record<OptimizationProfile, string> = {
  compliance:
    "Prioritize policy and risk detection, mitigation guidance, and compliant rewrites with transparent assumptions.",
  image:
    "Prioritize concrete visual detail, composition control, lighting specificity, and reusable prompt quality.",
  video:
    "Prioritize hook quality, pacing, narrative flow, segment structure, and clear call-to-action execution.",
  marketing:
    "Prioritize differentiated campaign angles, channel fit, persuasive clarity, and brand-safe messaging.",
  email:
    "Prioritize recipient fit, tone control, concise structure, subject quality, and actionable CTA clarity.",
  workflow:
    "Prioritize implementation-ready workflow structure with explicit inputs, outputs, constraints, and validation.",
  general:
    "Prioritize clear, practical prompt improvements with unambiguous instructions and strong formatting.",
  clarity:
    "Improve clarity by removing ambiguity, tightening wording, and making requirements explicit.",
  structure:
    "Restructure the prompt into clear sections: Goal, Context, Requirements, Constraints, Output Format.",
  detail:
    "Increase useful detail by adding missing context and concrete constraints while preserving intent.",
  healthcare:
    "Apply conservative risk handling for healthcare-sensitive wording and require safe constraints.",
  finance:
    "Apply conservative risk handling for financial-sensitive wording and require defensible claims.",
  legal:
    "Apply conservative risk handling for legal-sensitive wording and avoid legal certainty or legal advice.",
};

const DEFAULT_OPTIMIZE_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "optimizedPrompt",
    "keyChanges",
    "recommendations",
    "structure",
    "scores",
    "missingFields",
    "riskFlags",
    "structuredData",
  ],
  properties: {
    optimizedPrompt: { type: "string" },
    keyChanges: {
      type: "array",
      items: { type: "string" },
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
    },
    structure: {
      type: "object",
      additionalProperties: true,
    },
    scores: {
      type: "object",
      additionalProperties: false,
      required: ["clarity", "context", "constraints", "format"],
      properties: {
        clarity: { type: "number", minimum: 0, maximum: 10 },
        context: { type: "number", minimum: 0, maximum: 10 },
        constraints: { type: "number", minimum: 0, maximum: 10 },
        format: { type: "number", minimum: 0, maximum: 10 },
      },
    },
    missingFields: {
      type: "array",
      items: { type: "string" },
    },
    riskFlags: {
      type: "array",
      items: { type: "string" },
    },
    structuredData: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;

function createClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new InternalError("Missing OPENAI_API_KEY", undefined, "MISSING_OPENAI_API_KEY");
  }

  return new OpenAI({ apiKey });
}

function buildInstructions(mode: OptimizeMode, goal?: string, workflow?: ToolWorkflow | null): string {
  const lines = workflow
    ? [
        workflow.kernelPrompt,
        `Skill identity: ${workflow.skillKey}.`,
        `Workflow purpose: ${workflow.workflowPurpose}.`,
        `Expected sections: ${workflow.defaultSections.join(", ")}.`,
      ]
    : ["You are a prompt optimizer."];

  lines.push(
    MODE_TO_INSTRUCTIONS[mode],
    "Preserve the original intent.",
    "Scores must be realistic and use a 0 to 10 scale.",
    "Return JSON only. No markdown, prose, or code fences.",
    "Follow the provided JSON schema exactly."
  );

  if (goal) {
    lines.push(`Primary optimization goal: ${goal}`);
  }

  return lines.join("\n");
}

function buildTemplateInstructions(templateSystemPrompt: string): string {
  return [
    "Template context (reference only; skill contract and output schema take precedence):",
    templateSystemPrompt,
  ].join("\n");
}

function resolveRunOptions(templateSystemPromptOrOptions?: string | OptimizeRunOptions): OptimizeRunOptions {
  if (!templateSystemPromptOrOptions) {
    return {};
  }

  if (typeof templateSystemPromptOrOptions === "string") {
    return { templateSystemPrompt: templateSystemPromptOrOptions };
  }

  return templateSystemPromptOrOptions;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeScoreOutOfTen(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value > 10 ? value / 10 : value;
  return clamp(normalized, 0, 10);
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toUnknownRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }
  return value;
}

function normalizeStructuredResult(
  candidate: unknown,
  workflow?: ToolWorkflow | null
): StructuredOptimizeResult {
  if (!isRecord(candidate)) {
    throw new Error("Model output is not an object");
  }

  const basePayload = {
    optimizedPrompt: candidate.optimizedPrompt,
    keyChanges: candidate.keyChanges,
    scores: candidate.scores,
    missingFields: candidate.missingFields,
    riskFlags: candidate.riskFlags,
  };
  const parsedBase = OptimizeResultSchema.safeParse(basePayload);
  if (!parsedBase.success) {
    throw new Error("Model output failed base result validation");
  }

  const recommendations = toStringArray(candidate.recommendations).slice(0, 20);
  const structure = toUnknownRecord(candidate.structure);
  const structuredData = toUnknownRecord(candidate.structuredData);

  if (workflow) {
    const missingContractKeys = workflow.requiredStructuredDataFields.filter(
      (field) => structuredData[field] === undefined
    );
    if (missingContractKeys.length > 0) {
      throw new Error(`Structured output missing required fields: ${missingContractKeys.join(", ")}`);
    }
  }

  return {
    ...parsedBase.data,
    recommendations,
    structure,
    structuredData,
    skillKey: workflow?.skillKey,
    toolKey: workflow?.toolKey,
    workflowProfile: workflow?.workflowProfile,
  };
}

function estimateHeuristicScores(result: StructuredOptimizeResult): StructuredOptimizeResult["scores"] {
  const text = result.optimizedPrompt;
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const totalLineLength = lines.reduce((sum, line) => sum + line.length, 0);
  const avgLineLength = lines.length > 0 ? totalLineLength / lines.length : text.length;

  const hasVariablesSection = /(^|\n)\s*variables\b/i.test(text);
  const hasSchemaSection = /(^|\n)\s*output json schema\b|(^|\n)\s*json schema\b/i.test(text);
  const hasValidationSection = /(^|\n)\s*validation rules?\b/i.test(text);
  const hasTestCasesSection = /(^|\n)\s*test cases?\b/i.test(text);
  const sectionCount = [hasVariablesSection, hasSchemaSection, hasValidationSection, hasTestCasesSection].filter(
    Boolean
  ).length;

  const bulletLineCount = lines.filter((line) => /^[-*]\s+|\d+\.\s+/.test(line)).length;
  const contextSignalCount = countMatches(
    text.toLowerCase(),
    /\b(goal|context|audience|scenario|input|output|constraints?|assumptions?)\b/g
  );
  const constraintSignalCount = countMatches(
    text.toLowerCase(),
    /\b(must|required|constraint|validate|validation|reject|fallback|limit)\b/g
  );
  const schemaSignalCount = countMatches(
    text.toLowerCase(),
    /\b(json|schema|properties|required|additionalproperties|type)\b/g
  );

  const longLinePenalty = avgLineLength > 180 ? 1.3 : avgLineLength > 130 ? 0.7 : 0;
  const missingPenalty = Math.min(2.4, result.missingFields.length * 0.35);
  const riskPenalty = Math.min(1.6, result.riskFlags.length * 0.25);

  const clarity =
    4.8 + sectionCount * 0.6 + Math.min(1.2, bulletLineCount * 0.12) - longLinePenalty - riskPenalty * 0.4;
  const context =
    4.5 + Math.min(2.3, contextSignalCount * 0.2) + Math.min(1.4, result.keyChanges.length * 0.2) - missingPenalty;
  const constraints =
    4.2 +
    Math.min(2.5, constraintSignalCount * 0.18) +
    (hasValidationSection ? 1.1 : 0) -
    missingPenalty * 0.7 -
    riskPenalty * 0.4;
  const format =
    4.4 +
    sectionCount * 0.9 +
    Math.min(1.1, schemaSignalCount * 0.08) +
    Math.min(0.8, bulletLineCount * 0.08) -
    longLinePenalty * 0.2;

  return {
    clarity: roundToOneDecimal(clamp(clarity, 0, 10)),
    context: roundToOneDecimal(clamp(context, 0, 10)),
    constraints: roundToOneDecimal(clamp(constraints, 0, 10)),
    format: roundToOneDecimal(clamp(format, 0, 10)),
  };
}

function normalizeAndRescore(result: StructuredOptimizeResult): StructuredOptimizeResult {
  const heuristic = estimateHeuristicScores(result);
  const modelScores = {
    clarity: normalizeScoreOutOfTen(result.scores.clarity),
    context: normalizeScoreOutOfTen(result.scores.context),
    constraints: normalizeScoreOutOfTen(result.scores.constraints),
    format: normalizeScoreOutOfTen(result.scores.format),
  };

  const blend = (modelScore: number, heuristicScore: number) =>
    roundToOneDecimal(clamp(modelScore * 0.35 + heuristicScore * 0.65, 0, 10));

  return {
    ...result,
    scores: {
      clarity: blend(modelScores.clarity, heuristic.clarity),
      context: blend(modelScores.context, heuristic.context),
      constraints: blend(modelScores.constraints, heuristic.constraints),
      format: blend(modelScores.format, heuristic.format),
    },
  };
}

async function requestStructuredResult(
  client: OpenAI,
  rawPrompt: string,
  mode: OptimizeMode,
  goal?: string,
  templateSystemPrompt?: string,
  workflow?: ToolWorkflow | null
): Promise<{
  candidate: unknown;
  tokenIn: number | null;
  tokenOut: number | null;
  model: string;
}> {
  const baseInstructions = buildInstructions(mode, goal, workflow);
  const instructions = templateSystemPrompt
    ? [baseInstructions, buildTemplateInstructions(templateSystemPrompt)].join("\n\n")
    : baseInstructions;
  const resultSchema = workflow?.outputSchema ?? DEFAULT_OPTIMIZE_RESULT_JSON_SCHEMA;

  const timeoutMs = getLlmTimeoutMs();
  const response = await new Promise<OpenAI.Responses.Response>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`LLM request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    client.responses
      .create({
        model: "gpt-4.1-mini",
        input: rawPrompt,
        instructions,
        temperature: 0.2,
        text: {
          format: {
            type: "json_schema",
            name: "optimize_result",
            strict: true,
            schema: resultSchema as Record<string, unknown>,
          },
        },
      })
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("Empty response from model");
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(outputText) as unknown;
  } catch {
    throw new Error("Malformed JSON in model output");
  }

  const usage = response.usage as
    | {
        input_tokens?: number;
        output_tokens?: number;
      }
    | undefined;

  return {
    candidate,
    tokenIn: typeof usage?.input_tokens === "number" ? usage.input_tokens : null,
    tokenOut: typeof usage?.output_tokens === "number" ? usage.output_tokens : null,
    model: typeof response.model === "string" ? response.model : "gpt-4.1-mini",
  };
}

export async function optimizePromptWithMeta(
  rawPrompt: string,
  mode: string,
  goal?: string,
  templateSystemPromptOrOptions?: string | OptimizeRunOptions
): Promise<OptimizePromptRun> {
  const options = resolveRunOptions(templateSystemPromptOrOptions);
  const parsedInput = OptimizeInputSchema.safeParse({ rawPrompt, mode, goal });
  if (!parsedInput.success) {
    throw new InternalError("Invalid optimizer input", parsedInput.error.flatten(), "INVALID_OPTIMIZER_INPUT");
  }

  const client = createClient();
  let lastFailure: unknown;
  const goalVariants: Array<string | undefined> =
    parsedInput.data.goal !== undefined ? [parsedInput.data.goal, undefined] : [undefined];

  for (const goalVariant of goalVariants) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await requestStructuredResult(
          client,
          parsedInput.data.rawPrompt,
          parsedInput.data.mode,
          goalVariant,
          options.templateSystemPrompt,
          options.workflow
        );

        const normalizedResult = normalizeStructuredResult(response.candidate, options.workflow);
        return {
          result: normalizeAndRescore(normalizedResult),
          tokenIn: response.tokenIn,
          tokenOut: response.tokenOut,
          model: response.model,
        };
      } catch (err: unknown) {
        lastFailure = {
          goalUsed: goalVariant !== undefined,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  throw new InternalError(
    "Optimizer returned invalid structured output after retry",
    { reason: lastFailure },
    "INVALID_OPTIMIZER_OUTPUT"
  );
}

export async function optimizePrompt(
  rawPrompt: string,
  mode: string,
  goal?: string,
  templateSystemPromptOrOptions?: string | OptimizeRunOptions
): Promise<StructuredOptimizeResult> {
  const run = await optimizePromptWithMeta(rawPrompt, mode, goal, templateSystemPromptOrOptions);
  return run.result;
}
