import Link from "next/link";
import { buildComplianceReport, parseComplianceFramework } from "../../../../lib/compliance";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../lib/rbac";
import { PageHeader } from "../../../../components/PageHeader";

type CompliancePageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ framework?: string }>;
};

const frameworkChips = [
  { id: "ALL", label: "All" },
  { id: "HIPAA", label: "HIPAA" },
  { id: "FINRA", label: "FINRA" },
  { id: "PCI_DSS", label: "PCI-DSS" },
  { id: "INTERNAL_POLICY", label: "Internal Policy" },
] as const;

function formatFrameworkLabel(value: string): string {
  if (value === "PCI_DSS") {
    return "PCI-DSS";
  }
  if (value === "INTERNAL_POLICY") {
    return "Internal Policy";
  }
  return value;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "No checks yet";
  }
  return new Date(value).toLocaleString();
}

function buildStatusSummary(hasSignals: boolean, riskLevel: "Low" | "Medium" | "High", highSeverityCount: number): {
  title: string;
  description: string;
} {
  if (!hasSignals) {
    return {
      title: "No compliance data yet",
      description: "Run optimize workflows to generate compliance-oriented findings for this workspace.",
    };
  }

  if (riskLevel === "High" || highSeverityCount > 0) {
    return {
      title: "Needs attention",
      description: "High-priority findings were detected. Review top issues before sharing outputs.",
    };
  }

  if (riskLevel === "Medium") {
    return {
      title: "Review recommended",
      description: "The workspace is operational, but there are moderate findings worth reviewing.",
    };
  }

  return {
    title: "Status looks healthy",
    description: "No major risk signals were detected in recent compliance-oriented reviews.",
  };
}

function severityChipStyles(severity: "LOW" | "MEDIUM" | "HIGH"): { borderColor: string; background: string; color: string } {
  if (severity === "HIGH") {
    return {
      borderColor: "rgba(186, 64, 64, 0.44)",
      background: "rgba(255, 231, 231, 0.9)",
      color: "#8f2a2a",
    };
  }
  if (severity === "MEDIUM") {
    return {
      borderColor: "rgba(177, 124, 41, 0.42)",
      background: "rgba(255, 243, 224, 0.9)",
      color: "#8a5a1f",
    };
  }
  return {
    borderColor: "rgba(73, 118, 183, 0.35)",
    background: "var(--chip-bg)",
    color: "var(--chip-text)",
  };
}

export default async function CompliancePage({ params, searchParams }: CompliancePageProps) {
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

  const requestedFramework = query.framework?.trim() || "";
  const parsedFramework = requestedFramework ? parseComplianceFramework(requestedFramework) : null;
  const hasInvalidFramework = Boolean(requestedFramework && !parsedFramework);

  const report = await buildComplianceReport(context.membership.orgId, {
    framework: parsedFramework,
    issueLimit: 180,
  });

  const encodedSlug = encodeURIComponent(context.membership.orgSlug);
  const riskBarWidth = Math.min(100, Math.max(0, report.risk.score));
  const exportBase = `/api/orgs/${encodedSlug}/compliance/export`;
  const frameworkParam = parsedFramework ? `&framework=${encodeURIComponent(parsedFramework)}` : "";
  const selectedFrameworkLabel =
    report.appliedFramework === "ALL" ? "All frameworks" : formatFrameworkLabel(report.appliedFramework);
  const topIssues = report.issues.slice(0, 6);
  const recentChanges = report.changeLog.slice(0, 8);
  const highSeverityCount = report.issues.filter((issue) => issue.severity === "HIGH").length;
  const latestCheckedAt = report.summary
    .map((item) => item.lastCheckedAt)
    .filter((item): item is string => Boolean(item))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const status = buildStatusSummary(report.hasSignals, report.risk.level, highSeverityCount);
  const readyToExport = report.hasSignals && (topIssues.length > 0 || recentChanges.length > 0);

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <section className="panel">
        <PageHeader
          title="Compliance Review"
          description="Review workspace findings, risk signals, and recent compliance-oriented changes."
        />
        {hasInvalidFramework ? (
          <p className="muted" style={{ marginBottom: "8px" }}>
            Unknown framework filter was ignored.
          </p>
        ) : null}
        <div className="chip-list" style={{ marginBottom: "8px" }}>
          {frameworkChips.map((chip) => {
            const selected =
              chip.id === "ALL"
                ? report.appliedFramework === "ALL"
                : report.appliedFramework === chip.id;
            const href =
              chip.id === "ALL"
                ? `/app/${encodedSlug}/compliance`
                : `/app/${encodedSlug}/compliance?framework=${encodeURIComponent(chip.id)}`;
            return (
              <Link
                key={chip.id}
                href={href}
                className="chip"
                style={{
                  textDecoration: "none",
                  borderColor: selected ? "var(--line-strong)" : undefined,
                  background: selected ? "var(--table-head-bg)" : undefined,
                  fontWeight: selected ? 600 : 500,
                }}
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
        <p className="muted" style={{ marginBottom: 0, fontSize: "12px" }}>
          Filter applied: <strong>{selectedFrameworkLabel}</strong>. This page provides operational review signals and is
          not legal advice.
        </p>
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Status Summary</h2>
        <p style={{ marginBottom: "6px" }}>
          <strong>{status.title}</strong>
        </p>
        <p className="muted" style={{ marginBottom: "12px" }}>
          {status.description}
        </p>
        <div
          style={{
            display: "grid",
            gap: "10px",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          }}
        >
          <article className="stat">
            <p>Risk level</p>
            <h3 style={{ margin: "8px 0 6px", fontSize: "24px" }}>{report.risk.level}</h3>
            <span>Score: {report.risk.score}/100</span>
          </article>
          <article className="stat">
            <p>Open findings</p>
            <h3 style={{ margin: "8px 0 6px", fontSize: "24px" }}>{report.issues.length}</h3>
            <span>Top 6 shown below</span>
          </article>
          <article className="stat">
            <p>High severity</p>
            <h3 style={{ margin: "8px 0 6px", fontSize: "24px" }}>{highSeverityCount}</h3>
            <span>Prioritize these first</span>
          </article>
          <article className="stat">
            <p>Last checked</p>
            <h3 style={{ margin: "8px 0 6px", fontSize: "18px" }}>{formatDateTime(latestCheckedAt)}</h3>
            <span>Updated at {formatDateTime(report.generatedAt)}</span>
          </article>
        </div>
        <div className="risk-line" style={{ marginBottom: 0 }}>
          <p className="muted" style={{ marginBottom: "6px" }}>
            {report.risk.rationale}
          </p>
          <div
            className="risk-fill"
            style={{
              width: `${riskBarWidth}%`,
            }}
          />
        </div>
      </section>

      <section className="panel">
        <div className="row-between" style={{ marginBottom: "10px", alignItems: "baseline" }}>
          <h2 style={{ marginBottom: 0 }}>Top Issues</h2>
          {report.issues.length > topIssues.length ? (
            <span className="muted" style={{ fontSize: "12px" }}>
              Showing {topIssues.length} of {report.issues.length}
            </span>
          ) : null}
        </div>
        {topIssues.length === 0 ? (
          <div className="card-block">
            <p style={{ marginBottom: "6px" }}>No findings for this filter yet.</p>
            <p className="muted" style={{ marginBottom: "10px" }}>
              Run optimize flows to generate compliance findings and risk signals.
            </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Link
                    href={`/app/${encodedSlug}/prompts/new`}
                    className="btn primary"
                    style={{ textDecoration: "none" }}
                  >
                    Open Workflow
                  </Link>
              <Link
                href={`/app/${encodedSlug}/audit`}
                className="btn ghost"
                style={{ textDecoration: "none" }}
              >
                View Audit Log
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {topIssues.map((issue) => (
              <article key={issue.id} className="card-block" style={{ display: "grid", gap: "8px" }}>
                <div className="row-between" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                      <span className="chip" style={severityChipStyles(issue.severity)}>
                        {issue.severity}
                      </span>
                      <span className="chip">{formatFrameworkLabel(issue.framework)}</span>
                    </div>
                    <h3 style={{ marginBottom: "4px" }}>{issue.title}</h3>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      {issue.details}
                    </p>
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: "12px", whiteSpace: "nowrap" }}>
                    {new Date(issue.detectedAt).toLocaleString()}
                  </p>
                </div>
                {issue.promptId ? (
                  <div>
                    <Link
                      href={`/app/${encodedSlug}/prompts/${encodeURIComponent(issue.promptId)}`}
                      className="btn ghost"
                      style={{ textDecoration: "none" }}
                    >
                      Open Prompt Workflow: {issue.promptTitle ?? issue.promptId}
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="row-between" style={{ marginBottom: "10px", alignItems: "baseline" }}>
          <h2 style={{ marginBottom: 0 }}>Recent Changes</h2>
          <Link href={`/app/${encodedSlug}/audit`} className="btn ghost" style={{ textDecoration: "none" }}>
            View Audit Log
          </Link>
        </div>
        {recentChanges.length === 0 ? (
          <p className="muted">No change log entries yet for this workspace.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {recentChanges.map((entry) => (
              <article key={entry.id} className="card-block" style={{ display: "grid", gap: "4px" }}>
                <div className="row-between" style={{ alignItems: "baseline" }}>
                  <h3 style={{ marginBottom: 0 }}>{entry.action}</h3>
                  <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                <p style={{ marginBottom: 0 }}>
                  <strong>{entry.who}</strong>
                  {entry.category ? ` - ${formatFrameworkLabel(entry.category)}` : ""}
                </p>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {entry.details}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel" id="export-report">
        <h2 style={{ marginBottom: "6px" }}>Export & Next Actions</h2>
        <p className="muted" style={{ marginBottom: "12px" }}>
          Export this view or continue review in audit and usage pages. This page is for operational guidance and is not legal advice.
        </p>
        {!readyToExport ? (
          <p className="muted" style={{ marginBottom: "10px" }}>
            Export is available, but this workspace has limited compliance signals so far.
          </p>
        ) : null}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <a className="btn primary" href={`${exportBase}?format=csv${frameworkParam}`}>
            Export Report (CSV)
          </a>
          <a className="btn ghost" href={`${exportBase}?format=json${frameworkParam}`}>
            Export JSON
          </a>
          <Link href={`/app/${encodedSlug}/usage`} className="btn ghost" style={{ textDecoration: "none" }}>
            View Usage
          </Link>
          <Link href={`/app/${encodedSlug}/prompts/new`} className="btn ghost" style={{ textDecoration: "none" }}>
            Open Workflow
          </Link>
        </div>
      </section>

      <section className="panel" id="model-compare">
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: "10px" }}>Advanced details</summary>
          <p className="muted" style={{ marginBottom: "12px" }}>
            Technical breakdown for deeper internal review.
          </p>
          <h3 style={{ marginBottom: "8px" }}>Risk signal breakdown</h3>
          <table style={{ marginBottom: "14px" }}>
            <thead>
              <tr>
                <th>Signal</th>
                <th>Value</th>
                <th>Weight</th>
                <th>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {report.risk.factors.map((factor) => (
                <tr key={factor.key}>
                  <td>{factor.label}</td>
                  <td>{factor.value}</td>
                  <td>{factor.weight}</td>
                  <td>{factor.contribution}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginBottom: "8px" }}>Model compare</h3>
          <p className="muted" style={{ marginBottom: "10px" }}>
            Config-driven model profiles from <code>src/lib/compliance/modelProfiles.ts</code>.
          </p>
          <div className="compare-grid">
            {report.modelProfiles.map((model) => (
              <article className="compare-card" key={model.id}>
                <h4 style={{ marginBottom: "8px" }}>{model.name}</h4>
                <ul style={{ marginBottom: "10px" }}>
                  <li>Schema adherence: {model.schemaAdherence}%</li>
                  <li>Latency: {model.latencyMs} ms</li>
                  <li>Cost: ${model.costUsdPer1kTokens.toFixed(4)} / 1K tokens</li>
                  <li>Compliance friendliness: {model.complianceFriendliness}%</li>
                  <li>Output control: {model.outputControl}</li>
                  <li>Fallback readiness: {model.fallbackReadiness}</li>
                </ul>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {model.notes}
                </p>
              </article>
            ))}
          </div>
        </details>
      </section>
    </section>
  );
}
