import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { HttpError } from "../../../lib/api/httpError";
import { error, success } from "../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../lib/api/errorDiagnostics";
import { reserveOrganizationSlug } from "../../../lib/auth/organization";
import { requireAuthenticatedUser } from "../../../lib/auth/server";
import { logAuditEvent } from "../../../lib/audit";

export const runtime = "nodejs";

type CreateOrgPayload = {
  name?: unknown;
};

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        role: true,
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(
      success({
        user: {
          id: user.id,
          clerkUserId: user.clerkUserId,
          email: user.email,
          name: user.name,
          lastActiveOrgId: user.lastActiveOrgId,
        },
        memberships: memberships.map((entry) => ({
          membershipId: entry.id,
          role: entry.role,
          orgId: entry.org.id,
          orgName: entry.org.name,
          orgSlug: entry.org.slug,
          createdAt: entry.org.createdAt,
        })),
      }),
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to list organizations"), { status: 500 });
  }
}

export async function POST(req: Request) {
  let payload: CreateOrgPayload;
  try {
    payload = (await req.json()) as CreateOrgPayload;
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const orgName = typeof payload.name === "string" ? payload.name.trim() : "";
  if (orgName.length < 2 || orgName.length > 120) {
    return NextResponse.json(error("VALIDATION_ERROR", "Organization name must be 2 to 120 characters"), {
      status: 400,
    });
  }

  try {
    const user = await requireAuthenticatedUser();
    const slug = await reserveOrganizationSlug(orgName);

    const organization = await prisma.$transaction(async (tx) => {
      const createdOrg = await tx.organization.create({
        data: {
          name: orgName,
          slug,
        },
      });

      await tx.membership.create({
        data: {
          orgId: createdOrg.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          lastActiveOrgId: createdOrg.id,
        },
      });

      await logAuditEvent(tx, {
        orgId: createdOrg.id,
        userId: user.id,
        action: "CREATE_ORG",
        resourceType: "Organization",
        resourceId: createdOrg.id,
        metadata: {
          orgName: createdOrg.name,
          orgSlug: createdOrg.slug,
        },
      });

      return createdOrg;
    });

    return NextResponse.json(
      success({
        orgId: organization.id,
        orgName: organization.name,
        orgSlug: organization.slug,
      }),
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create organization"), { status: 500 });
  }
}
