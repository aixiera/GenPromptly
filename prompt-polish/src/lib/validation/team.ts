import { z } from "zod";
import { EmailSchema } from "./auth";

export const OrganizationIdSchema = z
  .string()
  .trim()
  .min(1, "Organization id is required")
  .max(120, "Organization id is too long");

export const OrganizationSlugSchema = z
  .string()
  .trim()
  .min(1, "Organization slug is required")
  .max(120, "Organization slug is too long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Organization slug format is invalid");

export const RoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const CreateInviteSchema = z
  .object({
    email: EmailSchema,
    role: RoleSchema.default("MEMBER"),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  })
  .strict();

export const UpdateMembershipRoleSchema = z
  .object({
    userId: z.string().trim().min(1, "userId is required").max(120),
    role: RoleSchema,
  })
  .strict();

export const InviteIdSchema = z.string().trim().min(1, "Invite id is required").max(120);
