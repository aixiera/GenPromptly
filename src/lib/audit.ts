import type { Prisma } from "@prisma/client";
import prisma from "./db";

type AuditWriter = Prisma.TransactionClient | typeof prisma;

export type AuditEventInput = {
  orgId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

function readHeader(req: Request, key: string): string | null {
  const value = req.headers.get(key)?.trim();
  return value || null;
}

export function getRequestAuditContext(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
} {
  const forwardedFor = readHeader(req, "x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim() ?? null;
  return {
    ipAddress: firstForwarded ?? readHeader(req, "x-real-ip"),
    userAgent: readHeader(req, "user-agent"),
    requestId: readHeader(req, "x-request-id"),
  };
}

export async function logAuditEvent(writer: AuditWriter, input: AuditEventInput): Promise<void> {
  await writer.auditLog.create({
    data: {
      orgId: input.orgId,
      userId: input.userId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? null,
    },
  });
}
