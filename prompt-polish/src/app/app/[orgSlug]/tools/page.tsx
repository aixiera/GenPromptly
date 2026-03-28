import Link from "next/link";
import { PageHeader } from "../../../../components/PageHeader";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../lib/rbac";
import { listToolWorkflows } from "../../../../lib/tools/toolRegistry";

type ToolsPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ invalidSkill?: string; projectId?: string }>;
};

type UtilityCard = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
};

export default async function ToolsPage({ params, searchParams }: ToolsPageProps) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const context = await requireOrgPageContext(orgSlug);
  requirePermission(
    {
      role: context.membership.role,
      orgId: context.membership.orgId,
      userId: context.user.id,
    },
    "view_project"
  );

  const encodedSlug = encodeURIComponent(context.membership.orgSlug);
  const orgBase = `/app/${encodedSlug}`;
  const workflows = listToolWorkflows();
  const invalidSkill = query.invalidSkill?.trim() || "";

  const utilityCards: UtilityCard[] = [
    {
      title: "Prompt Compare",
      description: "Compare the latest prompt versions side-by-side before rollout.",
      href: `${orgBase}/tools/prompt-compare`,
      actionLabel: "Open Compare",
    },
    {
      title: "Compliance Review",
      description: "Inspect workspace findings, risk level, and recent compliance changes.",
      href: `${orgBase}/compliance`,
      actionLabel: "Open Review",
    },
    {
      title: "Export Center",
      description: "Download the current compliance report snapshot in CSV or JSON.",
      href: `${orgBase}/compliance#export-report`,
      actionLabel: "Export Report",
    },
    {
      title: "Usage Insights",
      description: "Review token usage, request volume, and model activity trends.",
      href: `${orgBase}/usage`,
      actionLabel: "View Usage",
    },
    {
      title: "Audit Log",
      description: "Review tenant-scoped activity history with filters and pagination.",
      href: `${orgBase}/audit`,
      actionLabel: "Open Audit Log",
    },
  ];

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <section className="panel">
        <PageHeader
          title="Tools"
          description="Use the 6 GenPromptly skills to optimize prompts for specific jobs, then review outputs in one workflow."
        />
        {invalidSkill ? (
          <p className="muted" style={{ marginBottom: "8px" }}>
            The workflow key <code>{invalidSkill}</code> is not valid. Choose one of the available skills below.
          </p>
        ) : null}
        <p style={{ marginBottom: "8px" }}>
          <strong>What do you want to do next?</strong>
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href={`${orgBase}/prompts/new`} className="btn primary" style={{ textDecoration: "none" }}>
            Open Workflow
          </Link>
          <Link href={`${orgBase}/compliance`} className="btn ghost" style={{ textDecoration: "none" }}>
            Open Review
          </Link>
          <Link href={`${orgBase}/usage`} className="btn ghost" style={{ textDecoration: "none" }}>
            View Usage
          </Link>
          <Link href={`${orgBase}/audit`} className="btn ghost" style={{ textDecoration: "none" }}>
            View Audit Log
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Core Skill Workflows</h2>
        <p className="muted" style={{ marginBottom: "12px" }}>
          Each skill launches a workflow-specific editor with the right prompt contract and optimize behavior.
        </p>
        <div
          style={{
            display: "grid",
            gap: "10px",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          {workflows.map((workflow) => (
            <article key={workflow.key} className="card-block" style={{ display: "grid", gap: "8px" }}>
              <div>
                <h3 style={{ marginBottom: "6px" }}>{workflow.name}</h3>
                <p className="muted" style={{ marginBottom: "6px" }}>
                  {workflow.description}
                </p>
                <p className="muted" style={{ marginBottom: "6px" }}>{workflow.workflowPurpose}</p>
                <p className="muted" style={{ marginBottom: "6px", fontSize: "12px" }}>{workflow.outputHint}</p>
              </div>
              <div className="row-between">
                <Link
                  href={`${orgBase}/tools/${encodeURIComponent(workflow.routeKey)}`}
                  className="btn primary"
                  style={{ textDecoration: "none" }}
                >
                  {workflow.launchLabel}
                </Link>
                <span className="muted" style={{ fontSize: "12px" }}>
                  {workflow.nextStepHint}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Review and Reporting</h2>
        <p className="muted" style={{ marginBottom: "12px" }}>
          Workspace utilities for comparison, governance, export, and observability.
        </p>
        <div
          style={{
            display: "grid",
            gap: "10px",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {utilityCards.map((card) => (
            <article key={card.title} className="card-block" style={{ display: "grid", gap: "8px" }}>
              <div>
                <h3 style={{ marginBottom: "6px" }}>{card.title}</h3>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {card.description}
                </p>
              </div>
              <div>
                <Link href={card.href} className="btn ghost" style={{ textDecoration: "none" }}>
                  {card.actionLabel}
                </Link>
              </div>
            </article>
          ))}
          <article
            className="card-block"
            style={{
              display: "grid",
              gap: "8px",
              opacity: 0.68,
              background: "linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(247, 252, 252, 0.72) 100%)",
            }}
          >
            <div>
              <h3 style={{ marginBottom: "6px" }}>Model Sandbox</h3>
              <p className="muted" style={{ marginBottom: 0 }}>
                Interactive sandboxing for ad-hoc model evaluation is planned for a future release.
              </p>
            </div>
            <div className="row-between">
              <span className="chip">Coming Soon</span>
              <span className="muted" style={{ fontSize: "12px" }}>
                Advanced feature preview
              </span>
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}
