import { z } from "zod";

export const CreateProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Project name is required").max(120, "Project name is too long"),
    orgId: z.string().trim().min(1, "orgId cannot be empty").max(120).optional(),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
