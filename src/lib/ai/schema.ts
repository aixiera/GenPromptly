import { z } from "zod";

const ScoreSchema = z.number().min(0).max(10);

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
