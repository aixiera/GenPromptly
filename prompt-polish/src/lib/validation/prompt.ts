import { z } from "zod";

export const CreatePromptSchema = z
  .object({
    projectId: z.string().trim().min(1, "projectId is required").max(120),
    title: z.string().trim().min(1, "Prompt title is required").max(200, "Prompt title is too long"),
    rawPrompt: z.string().trim().min(1, "rawPrompt is required").max(8000, "rawPrompt is too long"),
  })
  .strict();

export const UpdatePromptSchema = z
  .object({
    title: z.string().trim().min(1, "Prompt title cannot be empty").max(200).optional(),
    rawPrompt: z.string().trim().min(1, "rawPrompt cannot be empty").max(8000).optional(),
  })
  .strict()
  .refine((data) => data.title !== undefined || data.rawPrompt !== undefined, {
    message: "At least one field must be provided",
  });

export type CreatePromptInput = z.infer<typeof CreatePromptSchema>;
export type UpdatePromptInput = z.infer<typeof UpdatePromptSchema>;
