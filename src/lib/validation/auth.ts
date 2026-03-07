import { z } from "zod";

export const EmailSchema = z.string().trim().email("Invalid email").max(320, "Email is too long");

export const AcceptInviteSchema = z
  .object({
    token: z.string().trim().min(20, "token is required").max(400),
  })
  .strict();
