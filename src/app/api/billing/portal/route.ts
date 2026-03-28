import { NextResponse } from "next/server";
import { error, success } from "../../../../lib/api/response";
import { HttpError } from "../../../../lib/api/httpError";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthenticatedUser } from "../../../../lib/auth/server";
import { getOrCreateUserPlan } from "../../../../lib/billing/plan";
import { getStripeClient, resolveBillingAppOrigin } from "../../../../lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser({ ensureWorkspace: false });
    const stripe = getStripeClient();
    const appOrigin = resolveBillingAppOrigin(req);
    const userPlan = await getOrCreateUserPlan(user.id);

    if (!userPlan.stripeCustomerId) {
      return NextResponse.json(
        error("BILLING_PORTAL_UNAVAILABLE", "No Stripe billing profile exists for this account yet."),
        { status: 400 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userPlan.stripeCustomerId,
      return_url: `${appOrigin}/pricing`,
    });

    return NextResponse.json(
      success({
        url: portalSession.url,
      }),
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.billing.portal.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.billing.portal.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create billing portal session"), { status: 500 });
  }
}
