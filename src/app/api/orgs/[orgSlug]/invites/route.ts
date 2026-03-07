import { NextResponse } from "next/server";
import prisma from "../../../../../lib/db";
import { HttpError } from "../../../../../lib/api/httpError";
import { error, success } from "../../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../../lib/api/errorDiagnostics";
import { generateOpaqueToken, hashOpaqueToken, normalizeEmail } from "../../../../../lib/auth/crypto";
import { canAssignRole } from "../../../../../lib/auth/roles";
import { requireAuthContextWithoutOrg } from "../../../../../lib/auth/server";
import { requirePermission } from "../../../../../lib/rbac";
import { CreateInviteSchema, OrganizationSlugSchema } from "../../../../../lib/validation/team";
import { getRequestAuditContext, logAuditEvent } from "../../../../../lib/audit";
import { resolveAppOrigin } from "../../../../../lib/config/runtime";
import { enforceRateLimit, enforceRequestBodyLimit } from "../../../../../lib/security/rateLimit";

export const runtime = "nodejs";

type RouteContext = {
  params: { orgSlug: string } | Promise<{ orgSlug: string }>;
};

function resolveMembershipBySlug(
  memberships: Array<{ id: string; role: "OWNER" | "ADMIN" | "MEMBER"; org: { id: string; slug: string } }>,
  orgSlug: string
) {
  return memberships.find((entry) => entry.org.slug === orgSlug) ?? null;
}

function getInviteExpiry(days: number): Date {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
  return expiresAt;
}

export async function GET(req: Request, ctx: RouteContext) {
  const { orgSlug } = await ctx.params;
  const parsedSlug = OrganizationSlugSchema.safeParse(orgSlug);
  if (!parsedSlug.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid organization slug", parsedSlug.error.flatten()),
      { status: 400 }
    );
  }

  try {
    const auth = await requireAuthContextWithoutOrg(req);
    const orgMembership = resolveMembershipBySlug(auth.memberships, parsedSlug.data);
    if (!orgMembership) {
      return NextResponse.json(error("NOT_FOUND", "Organization not found"), { status: 404 });
    }
    requirePermission({ ...auth, role: orgMembership.role }, "view_project");
    const rateLimitDecision = await enforceRateLimit(
      req,
      "readHeavy",
      {
        userId: auth.userId,
        orgId: orgMembership.org.id,
        action: "list-invites",
      },
      "api.orgs.invites.get"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const invites = await prisma.invite.findMany({
      where: {
        orgId: orgMembership.org.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        revokedAt: true,
        invitedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        acceptedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(success(invites), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.invites.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.invites.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch organization invites"), { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteContext) {
  const bodyTooLarge = enforceRequestBodyLimit(req, 12_000, "api.orgs.invites.post");
  if (bodyTooLarge) {
    return bodyTooLarge;
  }

  const { orgSlug } = await ctx.params;
  const parsedSlug = OrganizationSlugSchema.safeParse(orgSlug);
  if (!parsedSlug.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid organization slug", parsedSlug.error.flatten()),
      { status: 400 }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsedBody = CreateInviteSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten()),
      { status: 400 }
    );
  }

  try {
    const auth = await requireAuthContextWithoutOrg(req);
    const orgMembership = resolveMembershipBySlug(auth.memberships, parsedSlug.data);
    if (!orgMembership) {
      return NextResponse.json(error("NOT_FOUND", "Organization not found"), { status: 404 });
    }
    requirePermission({ ...auth, role: orgMembership.role }, "invite_member");
    const rateLimitDecision = await enforceRateLimit(
      req,
      "inviteCreate",
      {
        userId: auth.userId,
        orgId: orgMembership.org.id,
        action: parsedBody.data.role,
      },
      "api.orgs.invites.post"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }
    try {

      if (!canAssignRole(orgMembership.role, parsedBody.data.role)) {
        return NextResponse.json(
          error("FORBIDDEN", "Your role cannot invite with the requested role", {
            actorRole: orgMembership.role,
            requestedRole: parsedBody.data.role,
          }),
          { status: 403 }
        );
      }

      const inviteEmail = normalizeEmail(parsedBody.data.email);
      const existingMember = await prisma.membership.findFirst({
        where: {
          orgId: orgMembership.org.id,
          user: {
            email: inviteEmail,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingMember) {
        return NextResponse.json(error("CONFLICT", "User is already a member of this organization"), {
          status: 409,
        });
      }

      const inviteToken = generateOpaqueToken();
      const inviteTokenHash = hashOpaqueToken(inviteToken);
      const expiresAt = getInviteExpiry(parsedBody.data.expiresInDays);
      const auditCtx = getRequestAuditContext(req);

      const createdInvite = await prisma.$transaction(async (tx) => {
        await tx.invite.updateMany({
          where: {
            orgId: orgMembership.org.id,
            email: inviteEmail,
            status: "PENDING",
          },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
          },
        });

        const invite = await tx.invite.create({
          data: {
            orgId: orgMembership.org.id,
            email: inviteEmail,
            role: parsedBody.data.role,
            token: inviteTokenHash,
            invitedByUserId: auth.userId,
            expiresAt,
          },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
        });

        await logAuditEvent(tx, {
          orgId: orgMembership.org.id,
          userId: auth.userId,
          action: "INVITE_MEMBER",
          resourceType: "Invite",
          resourceId: invite.id,
          metadata: {
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expiresAt.toISOString(),
          },
          ...auditCtx,
        });

        return invite;
      });

      const baseUrl = resolveAppOrigin(req);
      const inviteLink = `${baseUrl}/invite?token=${encodeURIComponent(inviteToken)}`;

      return NextResponse.json(
        success({
          ...createdInvite,
          inviteLink,
        }),
        { status: 201 }
      );
    } finally {
      rateLimitDecision.release?.();
    }
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.invites.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.invites.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create invite"), { status: 500 });
  }
}
