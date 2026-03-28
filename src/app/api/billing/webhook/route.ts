import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { error, success } from "../../../../lib/api/response";
import prisma from "../../../../lib/db";
import { logUnhandledApiError } from "../../../../lib/api/errorDiagnostics";
import { HttpError } from "../../../../lib/api/httpError";
import { getStripeClient, getStripeWebhookSecret } from "../../../../lib/billing/stripe";
import { isPlusSubscriptionStatusActive } from "../../../../lib/billing/plan";

export const runtime = "nodejs";

type StripeStateUpdate = {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
};

function toStripeId(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

function toDateFromUnixEpochSeconds(value: number | null | undefined): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000);
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (ends.length === 0) {
    return null;
  }
  const maxEnd = Math.max(...ends);
  return toDateFromUnixEpochSeconds(maxEnd);
}

async function resolveUserId(
  preferredUserId: string | null,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null
): Promise<string | null> {
  if (preferredUserId) {
    return preferredUserId;
  }

  if (stripeSubscriptionId) {
    const bySubscription = await prisma.userPlan.findUnique({
      where: { stripeSubscriptionId },
      select: { userId: true },
    });
    if (bySubscription) {
      return bySubscription.userId;
    }
  }

  if (stripeCustomerId) {
    const byCustomer = await prisma.userPlan.findUnique({
      where: { stripeCustomerId },
      select: { userId: true },
    });
    if (byCustomer) {
      return byCustomer.userId;
    }
  }

  return null;
}

async function persistStripeState(userId: string, state: StripeStateUpdate): Promise<void> {
  const now = Date.now();
  const isActiveStatus = isPlusSubscriptionStatusActive(state.subscriptionStatus);
  const hasPeriod = state.currentPeriodEnd ? state.currentPeriodEnd.getTime() > now : true;
  const shouldBePlus = isActiveStatus && hasPeriod;

  await prisma.userPlan.upsert({
    where: { userId },
    update: {
      plan: shouldBePlus ? "PLUS" : "FREE",
      stripeCustomerId: state.stripeCustomerId,
      stripeSubscriptionId: state.stripeSubscriptionId,
      subscriptionStatus: state.subscriptionStatus,
      currentPeriodEnd: state.currentPeriodEnd,
    },
    create: {
      userId,
      plan: shouldBePlus ? "PLUS" : "FREE",
      stripeCustomerId: state.stripeCustomerId,
      stripeSubscriptionId: state.stripeSubscriptionId,
      subscriptionStatus: state.subscriptionStatus,
      currentPeriodEnd: state.currentPeriodEnd,
    },
  });
}

function toStripeStateFromSubscription(subscription: Stripe.Subscription): StripeStateUpdate {
  return {
    stripeCustomerId: toStripeId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status ?? null,
    currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
  };
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const stripe = getStripeClient();
  const preferredUserId =
    session.metadata?.appUserId?.trim() || session.client_reference_id?.trim() || null;
  const stripeCustomerId = toStripeId(session.customer);
  const stripeSubscriptionId = toStripeId(session.subscription);
  const userId = await resolveUserId(preferredUserId, stripeCustomerId, stripeSubscriptionId);

  if (!userId) {
    console.warn("Stripe webhook checkout session could not be mapped to a user", {
      stripeCustomerId,
      stripeSubscriptionId,
      checkoutSessionId: session.id,
    });
    return;
  }

  if (stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      await persistStripeState(userId, toStripeStateFromSubscription(subscription));
      return;
    } catch (err: unknown) {
      console.warn("Failed to hydrate subscription on checkout completion webhook", {
        stripeSubscriptionId,
        userId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await persistStripeState(userId, {
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus: null,
    currentPeriodEnd: null,
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription): Promise<void> {
  const preferredUserId = subscription.metadata?.appUserId?.trim() || null;
  const stripeCustomerId = toStripeId(subscription.customer);
  const stripeSubscriptionId = subscription.id;
  const userId = await resolveUserId(preferredUserId, stripeCustomerId, stripeSubscriptionId);

  if (!userId) {
    console.warn("Stripe subscription webhook could not be mapped to a user", {
      stripeCustomerId,
      stripeSubscriptionId,
      status: subscription.status,
    });
    return;
  }

  await persistStripeState(userId, toStripeStateFromSubscription(subscription));
}

export async function POST(req: Request) {
  try {
    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json(error("BAD_REQUEST", "Missing Stripe signature header"), { status: 400 });
    }

    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: unknown) {
      return NextResponse.json(
        error("INVALID_SIGNATURE", "Webhook signature verification failed", {
          reason: err instanceof Error ? err.message : String(err),
        }),
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    return NextResponse.json(success({ received: true }), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    logUnhandledApiError("api.billing.webhook.post", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to process billing webhook"), { status: 500 });
  }
}
