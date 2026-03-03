import OpenAI from "openai";
import { z } from "zod";
import { InternalError } from "../api/httpError";
import { OptimizeResultSchema, type OptimizeResult } from "./schema";

const OptimizeInputSchema = z
  .object({
    rawPrompt: z.string().trim().min(1, "rawPrompt is required").max(8000, "rawPrompt is too long"),
    mode: z.enum(["clarity", "structure", "detail"]),
    goal: z.string().trim().min(1, "goal cannot be empty").max(300, "goal is too long").optional(),
  })
  .strict();

export type OptimizeMode = z.infer<typeof OptimizeInputSchema>["mode"];

const MODE_TO_INSTRUCTIONS: Record<OptimizeMode, string> = {
  clarity:
    "Improve clarity by removing ambiguity, tightening wording, and making requirements explicit.",
  structure:
    "Restructure the prompt into clear sections: Goal, Context, Requirements, Constraints, Output Format.",
  detail:
    "Increase useful detail by adding missing context and concrete constraints while preserving intent.",
};

const OPTIMIZE_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["optimizedPrompt", "keyChanges", "scores", "missingFields", "riskFlags"],
  properties: {
    optimizedPrompt: { type: "string" },
    keyChanges: {
      type: "array",
      items: { type: "string" },
    },
    scores: {
      type: "object",
      additionalProperties: false,
      required: ["clarity", "context", "constraints", "format"],
      properties: {
        clarity: { type: "integer", minimum: 0, maximum: 100 },
        context: { type: "integer", minimum: 0, maximum: 100 },
        constraints: { type: "integer", minimum: 0, maximum: 100 },
        format: { type: "integer", minimum: 0, maximum: 100 },
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
  },
} as const;

function createClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new InternalError("Missing OPENAI_API_KEY", undefined, "MISSING_OPENAI_API_KEY");
  }

  return new OpenAI({ apiKey });
}

function buildInstructions(mode: OptimizeMode, goal?: string): string {
  const lines = [
    "You are a prompt optimizer.",
    MODE_TO_INSTRUCTIONS[mode],
    "Preserve the original intent.",
    "Return JSON only. No markdown, prose, or code fences.",
  ];

  if (goal) {
    lines.push(`Primary optimization goal: ${goal}`);
  }

  return lines.join("\n");
}

async function requestStructuredResult(
  client: OpenAI,
  rawPrompt: string,
  mode: OptimizeMode,
  goal?: string
): Promise<unknown> {
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: rawPrompt,
    instructions: buildInstructions(mode, goal),
    temperature: 0.2,
    text: {
      format: {
        type: "json_schema",
        name: "optimize_result",
        strict: true,
        schema: OPTIMIZE_RESULT_JSON_SCHEMA,
      },
    },
  });

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("Empty response from model");
  }

  return JSON.parse(outputText) as unknown;
}

export async function optimizePrompt(rawPrompt: string, mode: string, goal?: string): Promise<OptimizeResult> {
  const parsedInput = OptimizeInputSchema.safeParse({ rawPrompt, mode, goal });
  if (!parsedInput.success) {
    throw new InternalError("Invalid optimizer input", parsedInput.error.flatten(), "INVALID_OPTIMIZER_INPUT");
  }

  const client = createClient();
  let lastFailure: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const candidate = await requestStructuredResult(
        client,
        parsedInput.data.rawPrompt,
        parsedInput.data.mode,
        parsedInput.data.goal
      );

      const parsedOutput = OptimizeResultSchema.safeParse(candidate);
      if (parsedOutput.success) {
        return parsedOutput.data;
      }

      lastFailure = parsedOutput.error.flatten();
    } catch (err: unknown) {
      lastFailure = err instanceof Error ? err.message : String(err);
    }
  }

  throw new InternalError(
    "Optimizer returned invalid structured output after retry",
    { reason: lastFailure },
    "INVALID_OPTIMIZER_OUTPUT"
  );
}
