import Link from "next/link";
import { BillingActionButton } from "../../../../components/BillingActionButton";
import { PageHeader } from "../../../../components/PageHeader";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { FREE_OPTIMIZE_LIMIT, PLUS_MONTHLY_PRICE_CAD } from "../../../../lib/billing/constants";
import { getOrCreateUserPlan, toBillingSnapshot } from "../../../../lib/billing/plan";

type BillingPageProps = {
  params: Promise<{ orgSlug: string }>;
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

export default async function BillingPage({ params }: BillingPageProps) {
  const { orgSlug } = await params;
  const context = await requireOrgPageContext(orgSlug);
  const userPlan = await getOrCreateUserPlan(context.user.id);
  const billing = toBillingSnapshot(userPlan);
  const encodedSlug = encodeURIComponent(context.membership.orgSlug);

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <section className="panel">
        <PageHeader
          title="Billing"
          description="User-level billing controls for your account."
          actions={(
            <Link href="/pricing" className="btn ghost" style={{ textDecoration: "none" }}>
              Open Public Pricing
            </Link>
          )}
        />
        <div className="card-block">
          <p style={{ marginBottom: "6px" }}>
            Current plan: <strong>{billing.effectivePlan}</strong>
          </p>
          <p className="muted" style={{ marginBottom: "6px" }}>
            Free optimizations used: {billing.freeOptimizeUsed} / {FREE_OPTIMIZE_LIMIT}
          </p>
          <p className="muted" style={{ marginBottom: "6px" }}>
            Remaining free optimizations: {billing.freeOptimizeRemaining}
          </p>
          <p className="muted" style={{ marginBottom: "6px" }}>
            Subscription status: {billing.subscriptionStatus ?? "none"}
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Current period end: {formatPeriodEnd(billing.currentPeriodEnd)}
          </p>
        </div>
      </section>

      <section className="panel">
        <PageHeader
          title="Plan Actions"
          description={`Plus is CA$${PLUS_MONTHLY_PRICE_CAD}/month and removes the free optimization cap.`}
        />
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {billing.isPlusActive ? (
            <BillingActionButton
              action="portal"
              label="Manage Billing"
              pendingLabel="Opening Portal..."
              className="btn primary"
            />
          ) : (
            <BillingActionButton
              action="checkout"
              label="Upgrade to Plus"
              pendingLabel="Opening Checkout..."
              className="btn primary"
            />
          )}
          <Link href={`/app/${encodedSlug}/usage`} className="btn ghost" style={{ textDecoration: "none" }}>
            View Usage
          </Link>
          <Link href={`/app/${encodedSlug}/dashboard`} className="btn ghost" style={{ textDecoration: "none" }}>
            Back to Dashboard
          </Link>
        </div>
      </section>
    </section>
  );
}
