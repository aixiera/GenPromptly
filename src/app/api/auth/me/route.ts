import { NextResponse } from "next/server";
import { HttpError } from "../../../../lib/api/httpError";
import { error, success } from "../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../lib/auth/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuthContext(req);

    return NextResponse.json(
      success({
        userId: ctx.userId,
        clerkUserId: ctx.clerkUserId,
        email: ctx.email,
        name: ctx.name,
        orgId: ctx.orgId,
        orgSlug: ctx.orgSlug,
        role: ctx.role,
        membershipId: ctx.membershipId,
        memberships: ctx.memberships.map((entry) => ({
          orgId: entry.org.id,
          orgSlug: entry.org.slug,
          orgName: entry.org.name,
          role: entry.role,
          membershipId: entry.id,
        })),
      }),
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.auth.me.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.auth.me.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to fetch auth context"), { status: 500 });
  }
}
