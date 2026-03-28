import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { AppFooter } from "../components/AppFooter";

export default async function HomePage() {
  const identity = await auth();
  const isSignedIn = Boolean(identity.userId);
  const startFreeHref = isSignedIn ? "/app" : "/sign-up";
  const createPromptHref = isSignedIn ? "/app" : "/sign-up";

  return (
    <main style={{ minHeight: "100vh", padding: "24px", maxWidth: "1080px", margin: "0 auto" }}>
      <section className="panel">
        <p className="muted" style={{ marginBottom: "8px" }}>OpsForLocal Product</p>
        <h1 style={{ marginBottom: "8px" }}>GenPromptly</h1>
        <p className="muted" style={{ marginBottom: "14px", maxWidth: "760px" }}>
          GenPromptly helps make prompts clearer, adds structure for common workflows, and supports review with
          audit-friendly records.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href={startFreeHref} className="btn primary" style={{ textDecoration: "none" }}>
            Start Free
          </Link>
          <Link href="/pricing" className="btn ghost" style={{ textDecoration: "none" }}>
            View Pricing
          </Link>
          <Link href="/sign-in" className="btn ghost" style={{ textDecoration: "none" }}>
            Sign In
          </Link>
          <Link href={createPromptHref} className="btn ghost" style={{ textDecoration: "none" }}>
            Create Prompt
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "8px" }}>Who It Is For</h2>
        <p className="muted" style={{ marginBottom: "8px" }}>
          Prompt engineers, AI operations teams, growth teams, and compliance-sensitive operators
          who need repeatable prompt quality instead of ad hoc edits.
        </p>
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "8px" }}>6 Core Skills</h2>
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <article className="card-block">
            <strong>Workflow Spec</strong>
            <p className="muted" style={{ margin: "6px 0 0 0" }}>Structure implementation-ready workflows.</p>
          </article>
          <article className="card-block">
            <strong>Email Pack</strong>
            <p className="muted" style={{ margin: "6px 0 0 0" }}>Build concise email prompts with strong CTA paths.</p>
          </article>
          <article className="card-block">
            <strong>Marketing Variants</strong>
            <p className="muted" style={{ margin: "6px 0 0 0" }}>Generate differentiated campaign prompt variants.</p>
          </article>
          <article className="card-block">
            <strong>Video Script</strong>
            <p className="muted" style={{ margin: "6px 0 0 0" }}>Improve hooks, pacing, and visual script structure.</p>
          </article>
          <article className="card-block">
            <strong>Image to Prompt</strong>
            <p className="muted" style={{ margin: "6px 0 0 0" }}>Translate image intent into high-control prompt text.</p>
          </article>
          <article className="card-block">
            <strong>Compliance Review</strong>
            <p className="muted" style={{ margin: "6px 0 0 0" }}>Identify risk flags and safer rewrite guidance.</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "8px" }}>Plans</h2>
        <p className="muted" style={{ marginBottom: "8px", fontWeight: 700 }}>
          Free to try - 8 successful optimizations included per account. Plus is CA$10/month for ongoing
          optimization.
        </p>
        <p className="legal-callout" style={{ marginBottom: "10px" }}>
          Subscriptions renew automatically until canceled. All fees are non-refundable except where required by
          applicable law.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href={startFreeHref} className="btn primary" style={{ textDecoration: "none" }}>
            Create Free Account
          </Link>
          <Link href="/pricing" className="btn ghost" style={{ textDecoration: "none" }}>
            Compare Plans
          </Link>
        </div>
      </section>

      <AppFooter />
    </main>
  );
}
