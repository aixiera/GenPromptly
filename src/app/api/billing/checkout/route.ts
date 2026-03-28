import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import { error, success } from "../../../../lib/api/response";
import { HttpError } from "../../../../lib/api/httpError";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthenticatedUser } from "../../../../lib/auth/server";
import { getOrCreateUserPlan, isUserPlanPlusActive } from "../../../../lib/billing/plan";
import { getStripeClient, getStripePlusPriceId, resolveBillingAppOrigin } from "../../../../lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser({ ensureWorkspace: false });
    const stripe = getStripeClient();
    const plusPriceId = getStripePlusPriceId();
    const appOrigin = resolveBillingAppOrigin(req);
    const userPlan = await getOrCreateUserPlan(user.id);

    if (isUserPlanPlusActive(userPlan)) {
      return NextResponse.json(
        error("ALREADY_PLUS", "Your Plus subscription is already active. Manage billing from the pricing page."),
        { status: 409 }
      );
    }

    let stripeCustomerId = userPlan.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: {
          appUserId: user.id,
          clerkUserId: user.clerkUserId,
        },
      });

      stripeCustomerId = customer.id;
      await prisma.userPlan.update({
        where: { userId: user.id },
        data: { stripeCustomerId },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: plusPriceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        appUserId: user.id,
        clerkUserId: user.clerkUserId,
      },
      subscription_data: {
        metadata: {
          appUserId: user.id,
          clerkUserId: user.clerkUserId,
        },
      },
      success_url: `${appOrigin}/pricing?checkout=success`,
      cancel_url: `${appOrigin}/pricing?checkout=cancel`,
    });

    if (!checkoutSession.url) {
      throw new HttpError(502, "STRIPE_CHECKOUT_ERROR", "Stripe checkout did not return a redirect URL.");
    }

    return NextResponse.json(
      success({
        url: checkoutSession.url,
      }),
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.billing.checkout.post");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.billing.checkout.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create checkout session"), { status: 500 });
  }
}
