import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../lib/db";
import { HttpError } from "../../../../lib/api/httpError";
import { error, success } from "../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthenticatedUser } from "../../../../lib/auth/server";
import { enforceRateLimit, enforceRequestBodyLimit } from "../../../../lib/security/rateLimit";

export const runtime = "nodejs";

const OrgSwitchSchema = z
  .object({
    orgId: z.string().trim().min(1).max(120).optional(),
    orgSlug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120)
      .optional(),
  })
  .strict()
  .refine((payload) => Boolean(payload.orgId || payload.orgSlug), {
    message: "orgId or orgSlug is required",
    path: ["orgId"],
  });

export async function POST(req: Request) {
  const bodyTooLarge = enforceRequestBodyLimit(req, 8_000, "api.orgs.switch.post");
  if (bodyTooLarge) {
    return bodyTooLarge;
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(error("BAD_REQUEST", "Invalid JSON body"), { status: 400 });
  }

  const parsedBody = OrgSwitchSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(error("VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten()), {
      status: 400,
    });
  }
  const requestedOrgId = parsedBody.data.orgId ?? "";
  const requestedOrgSlug = parsedBody.data.orgSlug ?? "";

  try {
    const user = await requireAuthenticatedUser();
    const rateLimitDecision = await enforceRateLimit(
      req,
      "orgSwitch",
      {
        userId: user.id,
        action: requestedOrgSlug || requestedOrgId || "switch",
      },
      "api.orgs.switch.post"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }
    const memberships = await prisma.membership.findMany({
      where: {
        userId: user.id,
      },
      select: {
        org: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const membership = memberships.find((entry) => {
      if (requestedOrgId) {
        return entry.org.id === requestedOrgId;
      }
      return entry.org.slug === requestedOrgSlug;
    });

    if (!membership) {
      return NextResponse.json(error("NOT_FOUND", "Organization not found"), { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveOrgId: membership.org.id },
    });

    return NextResponse.json(
      success({
        orgId: membership.org.id,
        orgSlug: membership.org.slug,
        orgName: membership.org.name,
      }),
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.switch.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.switch.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to switch workspace"), { status: 500 });
  }
}
