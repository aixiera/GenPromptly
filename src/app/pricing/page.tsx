import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { AppFooter } from "../../components/AppFooter";
import { BillingActionButton } from "../../components/BillingActionButton";
import { requireAuthenticatedUser } from "../../lib/auth/server";
import { FREE_OPTIMIZE_LIMIT, PLUS_MONTHLY_PRICE_CAD } from "../../lib/billing/constants";
import { getOrCreateUserPlan, toBillingSnapshot } from "../../lib/billing/plan";

export const metadata: Metadata = {
  title: "Pricing | GenPromptly",
  description: "Free and Plus pricing for GenPromptly prompt optimization workflows.",
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
    <main style={{ minHeight: "100vh", padding: "24px", maxWidth: "1040px", margin: "0 auto" }}>
      <section className="panel">
        <h1 style={{ marginBottom: "8px" }}>Pricing</h1>
        <p className="muted" style={{ marginBottom: "12px" }}>
          Start free with {FREE_OPTIMIZE_LIMIT} successful optimizations. Upgrade to Plus for CA$
          {PLUS_MONTHLY_PRICE_CAD}/month to continue.
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/" className="btn ghost" style={{ textDecoration: "none" }}>
            Back to Home
          </Link>
          {!isSignedIn ? (
            <Link href="/sign-up" className="btn primary" style={{ textDecoration: "none" }}>
              Start Free
            </Link>
          ) : (
            <Link href="/app" className="btn ghost" style={{ textDecoration: "none" }}>
              Open App
            </Link>
          )}
        </div>
      </section>

      {query.checkout === "success" ? (
        <section className="panel">
          <p style={{ margin: 0 }}>
            Checkout completed. Billing status may take a few seconds to sync via webhook.
          </p>
        </section>
      ) : null}
      {query.checkout === "cancel" ? (
        <section className="panel">
          <p style={{ margin: 0 }}>Checkout canceled. Your current plan remains unchanged.</p>
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: "12px",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <article className="panel" style={{ marginBottom: 0 }}>
          <h2 style={{ marginBottom: "8px" }}>Free</h2>
          <p className="muted" style={{ marginBottom: "10px" }}>
            For new accounts and initial product evaluation.
          </p>
          <ul style={{ marginBottom: "12px" }}>
            <li>Requires account registration</li>
            <li>{FREE_OPTIMIZE_LIMIT} prompt optimizations total per account</li>
            <li>Core prompt workflow experience</li>
            <li>Platform protections and fair use controls</li>
          </ul>
          {!isSignedIn ? (
            <Link href="/sign-up" className="btn primary" style={{ textDecoration: "none" }}>
              Sign Up Free
            </Link>
          ) : billingSnapshot ? (
            <>
              <p className="muted" style={{ margin: "0 0 8px 0" }}>
                Free optimizations used: {billingSnapshot.freeOptimizeUsed} / {FREE_OPTIMIZE_LIMIT}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                Remaining: {billingSnapshot.freeOptimizeRemaining}
              </p>
            </>
          ) : null}
        </article>

        <article className="panel" style={{ marginBottom: 0 }}>
          <h2 style={{ marginBottom: "8px" }}>Plus</h2>
          <p className="muted" style={{ marginBottom: "10px" }}>
            CA${PLUS_MONTHLY_PRICE_CAD}/month
          </p>
          <ul style={{ marginBottom: "12px" }}>
            <li>Continue optimizing prompts beyond the free quota</li>
            <li>Full ongoing access to optimization workflows</li>
            <li>Stripe-managed subscription and payment methods</li>
          </ul>
          {!isSignedIn ? (
            <Link href="/sign-up" className="btn primary" style={{ textDecoration: "none" }}>
              Sign Up to Upgrade
            </Link>
          ) : isPlus ? (
            <BillingActionButton action="portal" label="Manage Billing" pendingLabel="Opening Portal..." />
          ) : (
            <BillingActionButton action="checkout" label="Upgrade to Plus" pendingLabel="Opening Checkout..." />
          )}
        </article>
      </section>

      {isSignedIn && billingSnapshot ? (
        <section className="panel">
          <h2 style={{ marginBottom: "8px" }}>Current Billing State</h2>
          <p style={{ margin: "0 0 6px 0" }}>
            Current plan: <strong>{billingSnapshot.effectivePlan}</strong>
          </p>
          <p className="muted" style={{ margin: "0 0 6px 0" }}>
            Free usage: {billingSnapshot.freeOptimizeUsed} / {FREE_OPTIMIZE_LIMIT}
          </p>
          <p className="muted" style={{ margin: "0 0 6px 0" }}>
            Remaining free optimizations: {billingSnapshot.freeOptimizeRemaining}
          </p>
          <p className="muted" style={{ margin: "0 0 6px 0" }}>
            Subscription status: {billingSnapshot.subscriptionStatus ?? "none"}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Current period end: {formatPeriodEnd(billingSnapshot.currentPeriodEnd)}
          </p>
        </section>
      ) : null}

      <AppFooter />
    </main>
  );
}
