type GuardResult = {
  valid: boolean;
  problems: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const STRUCTURED_SECTION_PATTERN =
  /\b(variables|output schema|output json schema|steps|step-by-step|script|variants|findings|recommendations|workflow spec|risk level)\b/i;

export function validateOptimizeResult(result: unknown): GuardResult {
  const problems: string[] = [];

  if (!isRecord(result)) {
    return {
      valid: false,
      problems: ["result is not an object"],
    };
  }

  const optimizedPrompt = result.optimizedPrompt;
  if (typeof optimizedPrompt !== "string" || optimizedPrompt.trim().length < 220) {
    problems.push("optimizedPrompt must be at least 220 characters");
  } else if (!STRUCTURED_SECTION_PATTERN.test(optimizedPrompt)) {
    problems.push(
      "optimizedPrompt must contain at least one structured section keyword (Variables, Output Schema, Steps, Script, Variants)"
    );
  }

  const keyChanges = result.keyChanges;
  if (!Array.isArray(keyChanges) || keyChanges.length < 3) {
    problems.push("keyChanges must contain at least 3 items");
  }

  const scores = isRecord(result.scores) ? result.scores : null;
  if (!scores) {
    problems.push("scores must be an object");
  } else {
    const clarityScore = scores.clarity;
    const completenessScore = scores.completeness ?? scores.context;
    const constraintsScore = scores.constraints;
    const formatScore = scores.format;

    if (!isFiniteNumber(clarityScore)) {
      problems.push("scores.clarity is missing or not a number");
    }
    if (!isFiniteNumber(completenessScore)) {
      problems.push("scores.completeness is missing or not a number");
    }
    if (!isFiniteNumber(constraintsScore)) {
      problems.push("scores.constraints is missing or not a number");
    }
    if (!isFiniteNumber(formatScore)) {
      problems.push("scores.format is missing or not a number");
    }

    const scoreChecks = [
      ["scores.clarity", clarityScore],
      ["scores.completeness", completenessScore],
      ["scores.constraints", constraintsScore],
      ["scores.format", formatScore],
    ] as const;

    for (const [label, value] of scoreChecks) {
      if (isFiniteNumber(value) && (value < 0 || value > 10)) {
        problems.push(`${label} must be between 0 and 10`);
      }
    }
  }

  if (!Array.isArray(result.missingFields)) {
    problems.push("missingFields must be an array");
  }

  if (!Array.isArray(result.riskFlags)) {
    problems.push("riskFlags must be an array");
  }

  return {
    valid: problems.length === 0,
    problems,
  };
}
