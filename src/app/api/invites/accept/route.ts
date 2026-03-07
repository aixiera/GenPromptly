import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import {
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
} from "../../../../lib/api/httpError";
import { error, success } from "../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { hashOpaqueToken } from "../../../../lib/auth/crypto";
import { pickHigherRole } from "../../../../lib/auth/roles";
import { requireAuthenticatedUser } from "../../../../lib/auth/server";
import { getRequestAuditContext, logAuditEvent } from "../../../../lib/audit";
import { AcceptInviteSchema } from "../../../../lib/validation/auth";

export const runtime = "nodejs";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function getVerifiedPrimaryEmail(clerkUserId: string): Promise<string> {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);

  const primary = clerkUser.emailAddresses.find(
    (entry) => entry.id === clerkUser.primaryEmailAddressId
  );
  if (!primary) {
    throw new ForbiddenError("Authenticated user has no primary email", undefined, "MISSING_PRIMARY_EMAIL");
  }

  if (primary.verification?.status !== "verified") {
    throw new ForbiddenError(
      "Primary email must be verified before accepting invites",
      undefined,
      "EMAIL_NOT_VERIFIED"
    );
  }

  return normalizeEmail(primary.emailAddress);
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsed = AcceptInviteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      error("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten()),
      { status: 400 }
    );
  }

  try {
    const user = await requireAuthenticatedUser();
    const verifiedEmail = await getVerifiedPrimaryEmail(user.clerkUserId);
    const inviteToken = parsed.data.token;
    const inviteTokenHash = hashOpaqueToken(inviteToken);

    const invite = await prisma.invite.findFirst({
      where: {
        OR: [{ token: inviteTokenHash }, { token: inviteToken }],
      },
      select: {
        id: true,
        orgId: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundError("Invite not found");
    }

    const inviteEmail = normalizeEmail(invite.email);
    if (inviteEmail !== verifiedEmail) {
      console.warn("Invite acceptance blocked due to email mismatch", {
        inviteId: invite.id,
        inviteEmail,
        authenticatedEmail: verifiedEmail,
      });
      throw new ForbiddenError(
        "Invite email does not match authenticated user email",
        undefined,
        "INVITE_EMAIL_MISMATCH"
      );
    }

    if (invite.status !== "PENDING") {
      throw new ConflictError("Invite is no longer pending", { status: invite.status }, "INVITE_NOT_PENDING");
    }

    if (invite.expiresAt <= new Date()) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: {
          status: "EXPIRED",
        },
      });
      throw new ConflictError("Invite has expired", undefined, "INVITE_EXPIRED");
    }

    const auditCtx = getRequestAuditContext(req);
    const accepted = await prisma.$transaction(async (tx) => {
      const freshInvite = await tx.invite.findUnique({
        where: { id: invite.id },
        select: {
          id: true,
          orgId: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          org: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!freshInvite) {
        throw new NotFoundError("Invite not found");
      }
      if (freshInvite.status !== "PENDING") {
        throw new ConflictError(
          "Invite is no longer pending",
          { status: freshInvite.status },
          "INVITE_NOT_PENDING"
        );
      }
      if (freshInvite.expiresAt <= new Date()) {
        await tx.invite.update({
          where: { id: freshInvite.id },
          data: {
            status: "EXPIRED",
          },
        });
        throw new ConflictError("Invite has expired", undefined, "INVITE_EXPIRED");
      }

      const existingMembership = await tx.membership.findUnique({
        where: {
          orgId_userId: {
            orgId: freshInvite.orgId,
            userId: user.id,
          },
        },
        select: {
          id: true,
          role: true,
        },
      });

      const membership = await tx.membership.upsert({
        where: {
          orgId_userId: {
            orgId: freshInvite.orgId,
            userId: user.id,
          },
        },
        update: {
          role: existingMembership
            ? pickHigherRole(existingMembership.role, freshInvite.role)
            : freshInvite.role,
        },
        create: {
          orgId: freshInvite.orgId,
          userId: user.id,
          role: freshInvite.role,
        },
        select: {
          id: true,
          role: true,
        },
      });

      await tx.invite.update({
        where: { id: freshInvite.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          lastActiveOrgId: freshInvite.orgId,
        },
      });

      await logAuditEvent(tx, {
        orgId: freshInvite.orgId,
        userId: user.id,
        action: "ACCEPT_INVITE",
        resourceType: "Invite",
        resourceId: freshInvite.id,
        metadata: {
          email: freshInvite.email,
          inviteRole: freshInvite.role,
          effectiveRole: membership.role,
        },
        ...auditCtx,
      });

      return {
        orgId: freshInvite.org.id,
        orgSlug: freshInvite.org.slug,
        orgName: freshInvite.org.name,
        membershipId: membership.id,
        role: membership.role,
      };
    });

    return NextResponse.json(success(accepted), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.invites.accept.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.invites.accept.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to accept invite"), { status: 500 });
  }
}
