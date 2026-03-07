import Link from "next/link";
import { buildComplianceReport } from "../../../../lib/compliance";
import prisma from "../../../../lib/db";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../lib/rbac";
import { PageHeader } from "../../../../components/PageHeader";

type DashboardPageProps = {
  params: Promise<{ orgSlug: string }>;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return 0;
}

function formatActionLabel(action: string): string {
  return action
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "No checks yet";
  }
  return new Date(value).toLocaleString();
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { orgSlug } = await params;
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
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    projectCount,
    promptCount,
    memberCount,
    recentActivityCount,
    usageToday,
    activeModelsTodayRaw,
    recentAuditRows,
    complianceReport,
  ] = await Promise.all([
    prisma.project.count({
      where: { orgId: context.membership.orgId },
    }),
    prisma.prompt.count({
      where: { orgId: context.membership.orgId },
    }),
    prisma.membership.count({
      where: { orgId: context.membership.orgId },
    }),
    prisma.auditLog.count({
      where: {
        orgId: context.membership.orgId,
        createdAt: { gte: last24Hours },
      },
    }),
    prisma.usage.aggregate({
      where: {
        orgId: context.membership.orgId,
        createdAt: { gte: startOfToday },
      },
      _count: { _all: true },
      _sum: {
        tokenIn: true,
        tokenOut: true,
      },
    }),
    prisma.usage.findMany({
      where: {
        orgId: context.membership.orgId,
        createdAt: { gte: startOfToday },
      },
      distinct: ["model"],
      select: {
        model: true,
      },
      orderBy: {
        model: "asc",
      },
    }),
    prisma.auditLog.findMany({
      where: {
        orgId: context.membership.orgId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        action: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    buildComplianceReport(context.membership.orgId, {
      issueLimit: 500,
    }),
  ]);

  const latestCheckedAt =
    complianceReport.summary
      .map((item) => item.lastCheckedAt)
      .filter((entry): entry is string => Boolean(entry))
      .sort((left, right) => right.localeCompare(left))[0] ?? null;

  const openFindings = complianceReport.issues.length;
  const usageRequestsToday = usageToday._count._all;
  const usageTokensToday = toNumber(usageToday._sum.tokenIn) + toNumber(usageToday._sum.tokenOut);
  const activeModelsToday = activeModelsTodayRaw.length;

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <section className="panel">
        <PageHeader
          title="Dashboard"
          description="Workspace control center for activity, compliance signals, and next actions."
        />
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <article className="stat">
            <p>Prompts</p>
            <h3>{promptCount.toLocaleString()}</h3>
            <span>Total prompts in this workspace</span>
          </article>
          <article className="stat">
            <p>Projects</p>
            <h3>{projectCount.toLocaleString()}</h3>
            <span>Organized workstreams</span>
          </article>
          <article className="stat">
            <p>Open Compliance Findings</p>
            <h3>{openFindings.toLocaleString()}</h3>
            <span>Compliance-oriented findings</span>
          </article>
          <article className="stat">
            <p>Recent Activity</p>
            <h3>{recentActivityCount.toLocaleString()}</h3>
            <span>Audit events in last 24 hours</span>
          </article>
          <article className="stat">
            <p>Usage Requests</p>
            <h3>{usageRequestsToday.toLocaleString()}</h3>
            <span>Requests today</span>
          </article>
          <article className="stat">
            <p>Members</p>
            <h3>{memberCount.toLocaleString()}</h3>
            <span>Workspace users</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <PageHeader
          title="Quick Actions"
          description="Choose the next action to move work forward."
        />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href={`/app/${encodedSlug}/prompts/new`} className="btn primary" style={{ textDecoration: "none" }}>
            Open Workflow
          </Link>
          <Link href={`/app/${encodedSlug}/compliance`} className="btn ghost" style={{ textDecoration: "none" }}>
            Open Review
          </Link>
          <Link href={`/app/${encodedSlug}/usage`} className="btn ghost" style={{ textDecoration: "none" }}>
            View Usage
          </Link>
          <Link href={`/app/${encodedSlug}/audit`} className="btn ghost" style={{ textDecoration: "none" }}>
            View Audit Log
          </Link>
        </div>
      </section>

      <section className="panel">
        <PageHeader
          title="Recent Activity"
          description="Latest workspace actions from the audit log."
          actions={(
            <Link href={`/app/${encodedSlug}/audit`} className="btn ghost" style={{ textDecoration: "none" }}>
              Open Audit Log
            </Link>
          )}
        />
        {recentAuditRows.length === 0 ? (
          <div className="card-block">
            <p style={{ marginBottom: "6px" }}>No activity yet.</p>
            <p className="muted" style={{ margin: 0 }}>
              Activity events will appear after members create prompts, run optimize, and update workspace resources.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Who</th>
                <th>Action</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAuditRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.user?.name || row.user?.email || "System"}</td>
                  <td>{formatActionLabel(row.action)}</td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="panel" style={{ marginBottom: 0 }}>
          <PageHeader
            title="Compliance Snapshot"
            description="Current workspace risk and finding status."
            actions={(
              <Link href={`/app/${encodedSlug}/compliance`} className="btn ghost" style={{ textDecoration: "none" }}>
                Open Review
              </Link>
            )}
          />
          <div className="card-block">
            <p style={{ marginBottom: "8px" }}>
              Risk level: <strong>{complianceReport.risk.level}</strong>
            </p>
            <p className="muted" style={{ marginBottom: "6px" }}>
              Open findings: {openFindings.toLocaleString()}
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Last checked: {formatDateTime(latestCheckedAt)}
            </p>
          </div>
        </section>

        <section className="panel" style={{ marginBottom: 0 }}>
          <PageHeader
            title="Usage Snapshot"
            description="Today's request volume and model activity."
            actions={(
              <Link href={`/app/${encodedSlug}/usage`} className="btn ghost" style={{ textDecoration: "none" }}>
                View Usage
              </Link>
            )}
          />
          <div className="card-block">
            <p style={{ marginBottom: "8px" }}>
              Requests today: <strong>{usageRequestsToday.toLocaleString()}</strong>
            </p>
            <p className="muted" style={{ marginBottom: "6px" }}>
              Token usage today: {usageTokensToday.toLocaleString()}
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Active models today: {activeModelsToday.toLocaleString()}
            </p>
          </div>
        </section>
      </section>
    </section>
  );
}
