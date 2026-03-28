import { z } from "zod";

export const CreateProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Project name is required").max(120, "Project name is too long"),
  })
  .strict();

export const UpdateProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Project name is required").max(120, "Project name is too long"),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
