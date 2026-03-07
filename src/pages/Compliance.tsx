import { ComplianceBadge } from "../components/ComplianceBadge";
import type { ComplianceReport } from "../lib/compliance/types";

type ComplianceProps = {
  report: ComplianceReport | null;
  orgSlug: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
};

function formatFrameworkLabel(value: string): string {
  if (value === "PCI_DSS") {
    return "PCI-DSS";
  }
  if (value === "INTERNAL_POLICY") {
    return "Internal Policy";
  }
  return value;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function Compliance({ report, orgSlug, isLoading, error, onRetry }: ComplianceProps) {
  const riskWidth = report ? Math.min(100, Math.max(0, report.risk.score)) : 0;
  const changeLog = report?.changeLog.slice(0, 10) ?? [];
  const exportHref = orgSlug ? `/api/orgs/${encodeURIComponent(orgSlug)}/compliance/export?format=csv` : null;

  return (
    <section className="panel">
      <div className="row-between">
        <h2>Compliance & Audit Logs</h2>
        {exportHref ? (
          <a className="btn primary" href={exportHref}>
            Export Report
          </a>
        ) : (
          <button className="btn primary" disabled>
            Export Report
          </button>
        )}
      </div>
      <p className="muted" style={{ marginBottom: "10px" }}>
        Compliance findings are operational guidance and not legal advice.
      </p>

      <div className="badge-row">
        {(report?.summary ?? []).map((item) => (
          <ComplianceBadge key={item.framework} label={formatFrameworkLabel(item.framework)} />
        ))}
        {!report ? <ComplianceBadge label="No framework data" /> : null}
      </div>

      <div className="risk-line">
        <span>
          Risk Level: {report?.risk.level ?? "N/A"}
        </span>
        <div
          className="risk-fill"
          style={{
            width: `${riskWidth}%`,
          }}
        />
      </div>

      {isLoading ? <p className="muted">Loading compliance data...</p> : null}
      {error ? (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
          <p className="muted" style={{ margin: 0 }}>
            {error}
          </p>
          <button type="button" className="btn ghost" onClick={() => void onRetry()}>
            Retry
          </button>
        </div>
      ) : null}

      {report && changeLog.length === 0 ? (
        <p className="muted">No compliance changes recorded yet for this workspace.</p>
      ) : null}

      {changeLog.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Who</th>
              <th>What changed</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {changeLog.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.who}</td>
                <td>{entry.details || entry.action}</td>
                <td>{formatDateTime(entry.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export default Compliance;
