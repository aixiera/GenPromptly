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
      additionalProperties: false,
      required: ["goal", "context", "requirements", "constraints", "outputFormat", "steps"],
      properties: {
        goal: { type: "string" },
        context: { type: "string" },
        requirements: {
          type: "array",
          items: { type: "string" },
        },
        constraints: {
          type: "array",
          items: { type: "string" },
        },
        outputFormat: { type: "string" },
        steps: {
          type: "array",
          items: { type: "string" },
        },
      },
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
      additionalProperties: false,
      required: ["highlights", "notes", "nextSteps"],
      properties: {
        highlights: {
          type: "array",
          items: { type: "string" },
        },
        notes: {
          type: "array",
          items: { type: "string" },
        },
        nextSteps: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
} as const;

type JsonSchemaObject = Record<string, unknown>;

function isJsonSchemaObject(value: unknown): value is JsonSchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStrictJsonSchemaNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => toStrictJsonSchemaNode(entry));
  }
  if (!isJsonSchemaObject(node)) {
    return node;
  }

  const normalized: JsonSchemaObject = {};
  for (const [key, value] of Object.entries(node)) {
    normalized[key] = toStrictJsonSchemaNode(value);
  }

  const maybeProperties = normalized.properties;
  const hasProperties = isJsonSchemaObject(maybeProperties);
  const isObjectNode = normalized.type === "object" || hasProperties;
  if (isObjectNode) {
    const properties = hasProperties ? maybeProperties : {};
    normalized.type = "object";
    normalized.properties = properties;
    normalized.additionalProperties = false;
    normalized.required = Object.keys(properties);
  }

  return normalized;
}

function toStrictJsonSchema(schema: JsonSchemaObject): JsonSchemaObject {
  const normalized = toStrictJsonSchemaNode(schema);
  if (!isJsonSchemaObject(normalized)) {
    throw new Error("Optimize JSON schema must resolve to an object");
  }
  return normalized;
}

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
    const issue = parsedBase.error.issues[0];
    const issuePath = issue?.path.join(".") || "result";
    throw new Error(`Model output failed base result validation at ${issuePath}: ${issue?.message ?? "invalid field"}`);
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

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function unwrapCodeFence(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (!fencedMatch || typeof fencedMatch[1] !== "string") {
    return trimmed;
  }
  return fencedMatch[1].trim();
}

function extractFirstJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const openingIndices = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter((index) => index >= 0);
  if (openingIndices.length === 0) {
    return null;
  }
  const start = Math.min(...openingIndices);

  const openChar = trimmed[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  return null;
}

function toParsedObjectCandidate(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const nested = tryParseJson(value);
  if (!isRecord(nested)) {
    return null;
  }
  return nested;
}

function parseCandidateFromText(text: string): unknown | null {
  const direct = toParsedObjectCandidate(tryParseJson(text.trim()));
  if (direct !== null) {
    return direct;
  }

  const withoutFence = unwrapCodeFence(text);
  if (withoutFence !== text.trim()) {
    const parsed = toParsedObjectCandidate(tryParseJson(withoutFence));
    if (parsed !== null) {
      return parsed;
    }
  }

  const extracted = extractFirstJsonBlock(withoutFence);
  if (!extracted) {
    return null;
  }

  const parsedExtracted = toParsedObjectCandidate(tryParseJson(extracted));
  if (parsedExtracted !== null) {
    return parsedExtracted;
  }

  return null;
}

function parseStructuredCandidateFromResponse(response: OpenAI.Responses.Response): unknown {
  const textCandidates: string[] = [];
  const pushCandidate = (value: string | undefined) => {
    const candidate = value?.trim();
    if (candidate && !textCandidates.includes(candidate)) {
      textCandidates.push(candidate);
    }
  };

  pushCandidate(response.output_text);

  const outputItems = Array.isArray(response.output) ? response.output : [];
  for (const item of outputItems) {
    if (item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (content.type !== "output_text") {
        continue;
      }

      if ("parsed" in content && content.parsed !== null && content.parsed !== undefined) {
        return content.parsed;
      }

      pushCandidate(content.text);
    }
  }

  for (const textCandidate of textCandidates) {
    const parsed = parseCandidateFromText(textCandidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  if (response.error?.message) {
    throw new Error(`Model response error: ${response.error.message}`);
  }

  const refusalFound = outputItems.some(
    (item) =>
      item.type === "message" &&
      Array.isArray(item.content) &&
      item.content.some((content) => content.type === "refusal")
  );
  if (refusalFound) {
    throw new Error("Model refused to provide structured output");
  }

  if (textCandidates.length === 0) {
    throw new Error("Empty response from model");
  }

  throw new Error("Malformed JSON in model output");
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
  const strictResultSchema = toStrictJsonSchema(resultSchema as JsonSchemaObject);

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
            schema: strictResultSchema,
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

  const candidate = parseStructuredCandidateFromResponse(response);

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
  const isDev = process.env.NODE_ENV !== "production";
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
        const reason = err instanceof Error ? err.message : String(err);
        if (isDev) {
          console.warn("Optimizer attempt failed", {
            mode: parsedInput.data.mode,
            goalUsed: goalVariant !== undefined,
            attempt: attempt + 1,
            workflow: options.workflow?.skillKey ?? null,
            reason,
          });
        }
        lastFailure = {
          goalUsed: goalVariant !== undefined,
          reason,
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
