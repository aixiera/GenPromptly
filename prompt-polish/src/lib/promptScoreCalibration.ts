type RawScores = {
  clarity?: unknown;
  context?: unknown;
  completeness?: unknown;
  constraints?: unknown;
  format?: unknown;
};

type CalibratedScores = {
  clarity: number;
  context: number;
  constraints: number;
  format: number;
};

type ScoreCarrier = {
  scores: RawScores;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeScore(value: unknown, fallback: number): number {
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  return clamp(value, 0, 10);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function enforceSpread(scores: CalibratedScores): CalibratedScores {
  const values = [scores.clarity, scores.context, scores.constraints, scores.format];
  const max = Math.max(...values);
  const min = Math.min(...values);

  if (max - min <= 5.5) {
    return scores;
  }

  const mean = average(values);
  const compress = (value: number) => clamp(mean + (value - mean) * 0.6, 0, 10);

  return {
    clarity: compress(scores.clarity),
    context: compress(scores.context),
    constraints: compress(scores.constraints),
    format: compress(scores.format),
  };
}

function enforceAverageBounds(scores: CalibratedScores): CalibratedScores {
  const values = [scores.clarity, scores.context, scores.constraints, scores.format];
  const currentAvg = average(values);

  if (currentAvg >= 2 && currentAvg <= 9.5) {
    return scores;
  }

  const targetAvg = clamp(currentAvg, 2, 9.5);
  const delta = targetAvg - currentAvg;

  return {
    clarity: clamp(scores.clarity + delta, 0, 10),
    context: clamp(scores.context + delta, 0, 10),
    constraints: clamp(scores.constraints + delta, 0, 10),
    format: clamp(scores.format + delta, 0, 10),
  };
}

export function calibrateScores(result: ScoreCarrier): CalibratedScores {
  const rawScores = result.scores ?? {};

  const candidates = [
    rawScores.clarity,
    rawScores.context,
    rawScores.completeness,
    rawScores.constraints,
    rawScores.format,
  ].filter(isFiniteNumber);
  const fallback = clamp(average(candidates), 0, 10) || 6;

  const normalized: CalibratedScores = {
    clarity: normalizeScore(rawScores.clarity, fallback),
    context: normalizeScore(rawScores.context ?? rawScores.completeness, fallback),
    constraints: normalizeScore(rawScores.constraints, fallback),
    format: normalizeScore(rawScores.format, fallback),
  };

  const spreadAdjusted = enforceSpread(normalized);
  const avgAdjusted = enforceAverageBounds(spreadAdjusted);

  return {
    clarity: roundToOneDecimal(avgAdjusted.clarity),
    context: roundToOneDecimal(avgAdjusted.context),
    constraints: roundToOneDecimal(avgAdjusted.constraints),
    format: roundToOneDecimal(avgAdjusted.format),
  };
}
