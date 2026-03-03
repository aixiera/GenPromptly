import { z } from "zod";

const ScoreSchema = z.number().int().min(0).max(100);

export const OptimizeResultSchema = z
  .object({
    optimizedPrompt: z.string(),
    keyChanges: z.array(z.string()),
    scores: z
      .object({
        clarity: ScoreSchema,
        context: ScoreSchema,
        constraints: ScoreSchema,
        format: ScoreSchema,
      })
      .strict(),
    missingFields: z.array(z.string()),
    riskFlags: z.array(z.string()),
  })
  .strict();

export type OptimizeResult = z.infer<typeof OptimizeResultSchema>;
