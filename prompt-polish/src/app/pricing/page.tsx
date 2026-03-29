import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { BillingActionButton } from "../../components/BillingActionButton";
import { PublicFooter } from "../../components/public/PublicFooter";
import { PublicNavbar } from "../../components/public/PublicNavbar";
import { FREE_OPTIMIZE_LIMIT, PLUS_MONTHLY_PRICE_CAD } from "../../lib/billing/constants";
import { getOrCreateUserPlan, toBillingSnapshot } from "../../lib/billing/plan";
import { requireAuthenticatedUser } from "../../lib/auth/server";

export const metadata: Metadata = {
  title: "Pricing | GenPromptly",
  description: "Free and Plus pricing for GenPromptly within the broader Kairui Bi product ecosystem.",
};

type PricingPageProps = {
  searchParams: Promise<{ checkout?: string; portal?: string }>;
};

function formatPeriodEnd(date: Date | null): string {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const query = await searchParams;
  const identity = await auth();

  let billingSnapshot: ReturnType<typeof toBillingSnapshot> | null = null;
  if (identity.userId) {
    const user = await requireAuthenticatedUser({ ensureWorkspace: false });
    const userPlan = await getOrCreateUserPlan(user.id);
    billingSnapshot = toBillingSnapshot(userPlan);
  }

  const isSignedIn = Boolean(identity.userId);
  const isPlus = billingSnapshot?.isPlusActive ?? false;

  return (
    <div className="brand-site">
      <PublicNavbar />
      <main className="brand-main">
        <section className="brand-page-intro">
          <div className="brand-shell">
            <div className="brand-page-intro-card">
              <div>
                <p className="brand-section-eyebrow">Pricing</p>
                <h1 className="brand-page-title">GenPromptly pricing</h1>
                <p className="brand-page-description">
                  GenPromptly is a focused product inside the broader founder-led site. The plan structure stays simple:
                  free to try, plus a paid subscription for ongoing use.
                </p>
              </div>
              <div className="brand-page-actions">
                <Link href="/genpromptly" className="brand-button brand-button--ghost">
                  Back to GenPromptly
                </Link>
                <Link href={isSignedIn ? "/app" : "/sign-up"} className="brand-button brand-button--primary">
                  {isSignedIn ? "Open workspace" : "Start free"}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {(query.checkout === "success" || query.checkout === "cancel") && (
          <section className="brand-section brand-section--muted">
            <div className="brand-shell">
              <article className="brand-card">
                <p className="brand-card-text">
                  {query.checkout === "success"
                    ? "Checkout completed. Billing status may take a few seconds to sync via webhook."
                    : "Checkout canceled. Your current plan remains unchanged."}
                </p>
              </article>
            </div>
          </section>
        )}

        <section className="brand-section">
          <div className="brand-shell">
            <div className="brand-grid brand-grid--two">
              <article className="brand-card offer-card">
                <div className="offer-card-header">
                  <div>
                    <p className="offer-card-kicker">Free</p>
                    <h2 className="brand-card-title">Start with a small evaluation window</h2>
                  </div>
                  <p className="offer-card-price">CA$0</p>
                </div>
                <p className="brand-card-text">
                  Includes {FREE_OPTIMIZE_LIMIT} successful optimizations per account for initial product evaluation.
                </p>
                <ul className="brand-list">
                  <li>Account registration required</li>
                  <li>Core prompt workflow experience</li>
                  <li>Platform protections and fair use controls</li>
                  <li>Good for testing fit before subscribing</li>
                </ul>
                {!isSignedIn ? (
                  <Link href="/sign-up" className="brand-button brand-button--primary">
                    Create free account
                  </Link>
                ) : billingSnapshot ? (
                  <div className="offer-card-meta">
                    <p className="offer-card-label">Current free usage</p>
                    <p className="brand-card-text">
                      {billingSnapshot.freeOptimizeUsed} / {FREE_OPTIMIZE_LIMIT} used,{" "}
                      {billingSnapshot.freeOptimizeRemaining} remaining.
                    </p>
                  </div>
                ) : null}
              </article>

              <article className="brand-card offer-card">
                <div className="offer-card-header">
                  <div>
                    <p className="offer-card-kicker">Plus</p>
                    <h2 className="brand-card-title">Continue beyond the free quota</h2>
                  </div>
                  <p className="offer-card-price">CA${PLUS_MONTHLY_PRICE_CAD}/month</p>
                </div>
                <p className="brand-card-text">
                  Best for ongoing prompt optimization once the initial free limit is no longer enough.
                </p>
                <ul className="brand-list">
                  <li>Continue optimizing prompts beyond the free quota</li>
                  <li>Ongoing access to the prompt workflow</li>
                  <li>Stripe-managed subscription and payment methods</li>
                </ul>
                {!isSignedIn ? (
                  <Link href="/sign-up" className="brand-button brand-button--primary">
                    Sign up to upgrade
                  </Link>
                ) : isPlus ? (
                  <BillingActionButton
                    action="portal"
                    label="Manage billing"
                    pendingLabel="Opening portal..."
                    className="brand-button brand-button--primary"
                  />
                ) : (
                  <BillingActionButton
                    action="checkout"
                    label="Upgrade to Plus"
                    pendingLabel="Opening checkout..."
                    className="brand-button brand-button--primary"
                  />
                )}
                <p className="brand-card-text">
                  Subscriptions renew automatically until canceled. All fees are non-refundable except where required
                  by applicable law.
                </p>
              </article>
            </div>
          </div>
        </section>

        {isSignedIn && billingSnapshot ? (
          <section className="brand-section brand-section--muted">
            <div className="brand-shell">
              <article className="brand-card">
                <p className="brand-section-eyebrow">Current billing state</p>
                <div className="brand-grid brand-grid--two">
                  <div>
                    <p className="offer-card-label">Effective plan</p>
                    <p className="brand-card-text">{billingSnapshot.effectivePlan}</p>
                  </div>
                  <div>
                    <p className="offer-card-label">Subscription status</p>
                    <p className="brand-card-text">{billingSnapshot.subscriptionStatus ?? "none"}</p>
                  </div>
                  <div>
                    <p className="offer-card-label">Free usage</p>
                    <p className="brand-card-text">
                      {billingSnapshot.freeOptimizeUsed} / {FREE_OPTIMIZE_LIMIT}
                    </p>
                  </div>
                  <div>
                    <p className="offer-card-label">Current period end</p>
                    <p className="brand-card-text">{formatPeriodEnd(billingSnapshot.currentPeriodEnd)}</p>
                  </div>
                </div>
              </article>
            </div>
          </section>
        ) : null}
      </main>
      <PublicFooter />
    </div>
  );
}
