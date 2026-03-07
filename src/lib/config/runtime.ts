const DEFAULT_MODEL_INPUT_COST_PER_MILLION_USD = 0.4;
const DEFAULT_MODEL_OUTPUT_COST_PER_MILLION_USD = 1.6;
const DEFAULT_LLM_TIMEOUT_MS = 45_000;

function parseFiniteNumber(
  raw: string | undefined,
  fallback: number,
  options?: { min?: number; max?: number; envName?: string }
): number {
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number(raw);
  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    if (options?.envName) {
      console.warn(`Invalid ${options.envName}. Using fallback value.`);
    }
    return fallback;
  }

  return parsed;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getModelCostRates(): {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
} {
  return {
    inputPerMillionUsd: parseFiniteNumber(
      process.env.MODEL_INPUT_COST_PER_MILLION_USD,
      DEFAULT_MODEL_INPUT_COST_PER_MILLION_USD,
      {
        min: 0,
        max: 10_000,
        envName: "MODEL_INPUT_COST_PER_MILLION_USD",
      }
    ),
    outputPerMillionUsd: parseFiniteNumber(
      process.env.MODEL_OUTPUT_COST_PER_MILLION_USD,
      DEFAULT_MODEL_OUTPUT_COST_PER_MILLION_USD,
      {
        min: 0,
        max: 10_000,
        envName: "MODEL_OUTPUT_COST_PER_MILLION_USD",
      }
    ),
  };
}

export function estimateModelCostUsd(tokenIn: number, tokenOut: number): number {
  const rates = getModelCostRates();
  return tokenIn / 1_000_000 * rates.inputPerMillionUsd + tokenOut / 1_000_000 * rates.outputPerMillionUsd;
}

export function getLlmTimeoutMs(): number {
  const raw = parseFiniteNumber(process.env.LLM_TIMEOUT_MS, DEFAULT_LLM_TIMEOUT_MS, {
    min: 5_000,
    max: 180_000,
    envName: "LLM_TIMEOUT_MS",
  });
  return Math.floor(raw);
}

export function resolveAppOrigin(req: Request): string {
  const fallbackOrigin = new URL(req.url).origin;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!configured) {
    return fallbackOrigin;
  }

  try {
    return new URL(configured).origin;
  } catch {
    console.warn("Invalid NEXT_PUBLIC_APP_URL. Falling back to request origin.");
    return fallbackOrigin;
  }
}
