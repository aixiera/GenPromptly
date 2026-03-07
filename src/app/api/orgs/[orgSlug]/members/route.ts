import { NextResponse } from "next/server";
import prisma from "../../../../../lib/db";
import { HttpError } from "../../../../../lib/api/httpError";
import { error, success } from "../../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../../lib/api/errorDiagnostics";
import { canAssignRole, canManageRoleTransition, canRemoveRole } from "../../../../../lib/auth/roles";
import { requireAuthContextWithoutOrg } from "../../../../../lib/auth/server";
import { requirePermission } from "../../../../../lib/rbac";
import {
  OrganizationSlugSchema,
  UpdateMembershipRoleSchema,
} from "../../../../../lib/validation/team";
import { getRequestAuditContext, logAuditEvent } from "../../../../../lib/audit";

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

    const memberships = await prisma.membership.findMany({
      where: {
        orgId: orgMembership.org.id,
      },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            clerkUserId: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(success(memberships), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.members.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.members.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch organization members"), { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
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

  const parsedBody = UpdateMembershipRoleSchema.safeParse(payload);
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
    requirePermission({ ...auth, role: orgMembership.role }, "change_role");

    if (!canAssignRole(orgMembership.role, parsedBody.data.role)) {
      return NextResponse.json(
        error("FORBIDDEN", "Your role cannot assign the requested role", {
          actorRole: orgMembership.role,
          requestedRole: parsedBody.data.role,
        }),
        { status: 403 }
      );
    }

    const target = await prisma.membership.findUnique({
      where: {
        orgId_userId: {
          userId: parsedBody.data.userId,
          orgId: orgMembership.org.id,
        },
      },
      select: {
        id: true,
        userId: true,
        role: true,
      },
    });

    if (!target) {
      return NextResponse.json(error("NOT_FOUND", "Membership not found"), { status: 404 });
    }

    if (!canManageRoleTransition(orgMembership.role, target.role, parsedBody.data.role)) {
      return NextResponse.json(
        error("FORBIDDEN", "Your role cannot change this member role", {
          actorRole: orgMembership.role,
          currentTargetRole: target.role,
          requestedRole: parsedBody.data.role,
        }),
        { status: 403 }
      );
    }

    if (target.role === "OWNER" && parsedBody.data.role !== "OWNER") {
      const ownerCount = await prisma.membership.count({
        where: {
          orgId: orgMembership.org.id,
          role: "OWNER",
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(error("CONFLICT", "Cannot remove the last organization owner"), {
          status: 409,
        });
      }
    }

    const auditCtx = getRequestAuditContext(req);
    const updated = await prisma.$transaction(async (tx) => {
      const membership = await tx.membership.update({
        where: {
          orgId_userId: {
            userId: parsedBody.data.userId,
            orgId: orgMembership.org.id,
          },
        },
        data: {
          role: parsedBody.data.role,
        },
        select: {
          id: true,
          userId: true,
          role: true,
          orgId: true,
          updatedAt: true,
        },
      });

      await logAuditEvent(tx, {
        orgId: orgMembership.org.id,
        userId: auth.userId,
        action: "CHANGE_MEMBER_ROLE",
        resourceType: "Membership",
        resourceId: membership.id,
        metadata: {
          targetUserId: membership.userId,
          previousRole: target.role,
          nextRole: membership.role,
        },
        ...auditCtx,
      });

      return membership;
    });

    return NextResponse.json(success(updated), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.members.patch");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.members.patch", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to update member role"), { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const { orgSlug } = await ctx.params;
  const parsedSlug = OrganizationSlugSchema.safeParse(orgSlug);
  if (!parsedSlug.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid organization slug", parsedSlug.error.flatten()),
      { status: 400 }
    );
  }

  let payload: { userId?: unknown };
  try {
    payload = (await req.json()) as { userId?: unknown };
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  if (!userId) {
    return NextResponse.json(error("VALIDATION_ERROR", "userId is required"), { status: 400 });
  }

  try {
    const auth = await requireAuthContextWithoutOrg(req);
    const orgMembership = resolveMembershipBySlug(auth.memberships, parsedSlug.data);
    if (!orgMembership) {
      return NextResponse.json(error("NOT_FOUND", "Organization not found"), { status: 404 });
    }
    requirePermission({ ...auth, role: orgMembership.role }, "remove_member");

    const targetMembership = await prisma.membership.findUnique({
      where: {
        orgId_userId: {
          orgId: orgMembership.org.id,
          userId,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!targetMembership) {
      return NextResponse.json(error("NOT_FOUND", "Membership not found"), { status: 404 });
    }

    if (!canRemoveRole(orgMembership.role, targetMembership.role)) {
      return NextResponse.json(
        error("FORBIDDEN", "Your role cannot remove this member", {
          actorRole: orgMembership.role,
          targetRole: targetMembership.role,
        }),
        { status: 403 }
      );
    }

    if (targetMembership.role === "OWNER") {
      const ownerCount = await prisma.membership.count({
        where: {
          orgId: orgMembership.org.id,
          role: "OWNER",
        },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(error("CONFLICT", "Cannot remove the last organization owner"), {
          status: 409,
        });
      }
    }

    const auditCtx = getRequestAuditContext(req);
    await prisma.$transaction(async (tx) => {
      await tx.membership.delete({
        where: {
          orgId_userId: {
            orgId: orgMembership.org.id,
            userId,
          },
        },
      });

      await logAuditEvent(tx, {
        orgId: orgMembership.org.id,
        userId: auth.userId,
        action: "REMOVE_MEMBER",
        resourceType: "Membership",
        resourceId: targetMembership.id,
        metadata: {
          removedUserId: userId,
          removedRole: targetMembership.role,
        },
        ...auditCtx,
      });
    });

    return NextResponse.json(success({ removedUserId: userId }), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.members.delete");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.members.delete", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to remove member"), { status: 500 });
  }
}
