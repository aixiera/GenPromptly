import { NextResponse } from "next/server";
import prisma from "../../../../../../lib/db";
import { HttpError } from "../../../../../../lib/api/httpError";
import { error, success } from "../../../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../../../lib/api/errorDiagnostics";
import { requireAuthContextWithoutOrg } from "../../../../../../lib/auth/server";
import { requirePermission } from "../../../../../../lib/rbac";
import { InviteIdSchema, OrganizationSlugSchema } from "../../../../../../lib/validation/team";
import { getRequestAuditContext, logAuditEvent } from "../../../../../../lib/audit";
import { enforceRateLimit } from "../../../../../../lib/security/rateLimit";

export const runtime = "nodejs";

type RouteContext = {
  params: { orgSlug: string; inviteId: string } | Promise<{ orgSlug: string; inviteId: string }>;
};

function resolveMembershipBySlug(
  memberships: Array<{ id: string; role: "OWNER" | "ADMIN" | "MEMBER"; org: { id: string; slug: string } }>,
  orgSlug: string
) {
  return memberships.find((entry) => entry.org.slug === orgSlug) ?? null;
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { orgSlug, inviteId } = await ctx.params;
  const parsedOrgSlug = OrganizationSlugSchema.safeParse(orgSlug);
  if (!parsedOrgSlug.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid organization slug", parsedOrgSlug.error.flatten()),
      { status: 400 }
    );
  }
  const parsedInviteId = InviteIdSchema.safeParse(inviteId);
  if (!parsedInviteId.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid invite id", parsedInviteId.error.flatten()), {
      status: 400,
    });
  }

  try {
    const auth = await requireAuthContextWithoutOrg(req);
    const orgMembership = resolveMembershipBySlug(auth.memberships, parsedOrgSlug.data);
    if (!orgMembership) {
      return NextResponse.json(error("NOT_FOUND", "Organization not found"), { status: 404 });
    }
    requirePermission({ ...auth, role: orgMembership.role }, "invite_member");
    const rateLimitDecision = await enforceRateLimit(
      req,
      "inviteRevoke",
      {
        userId: auth.userId,
        orgId: orgMembership.org.id,
        action: "revoke",
      },
      "api.orgs.invites.revoke.delete"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }

    const invite = await prisma.invite.findFirst({
      where: {
        id: parsedInviteId.data,
        orgId: orgMembership.org.id,
      },
      select: {
        id: true,
        status: true,
        email: true,
      },
    });

    if (!invite) {
      return NextResponse.json(error("NOT_FOUND", "Invite not found"), { status: 404 });
    }

    if (invite.status !== "PENDING") {
      return NextResponse.json(error("CONFLICT", "Only pending invites can be revoked"), { status: 409 });
    }

    const auditCtx = getRequestAuditContext(req);
    await prisma.$transaction(async (tx) => {
      await tx.invite.update({
        where: { id: invite.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
        },
      });

      await logAuditEvent(tx, {
        orgId: orgMembership.org.id,
        userId: auth.userId,
        action: "REVOKE_INVITE",
        resourceType: "Invite",
        resourceId: invite.id,
        metadata: {
          email: invite.email,
        },
        ...auditCtx,
      });
    });

    return NextResponse.json(success({ id: invite.id, status: "REVOKED" }), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.invites.revoke.delete");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.invites.revoke.delete", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to revoke invite"), { status: 500 });
  }
}
