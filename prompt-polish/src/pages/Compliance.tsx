import { ComplianceBadge } from "../components/ComplianceBadge";

export function Compliance() {
  return (
    <section className="panel">
      <div className="row-between">
        <h2>Compliance & Audit Logs</h2>
        <button className="btn primary">Export report</button>
      </div>
      <div className="badge-row">
        <ComplianceBadge label="HIPAA" />
        <ComplianceBadge label="FINRA" />
        <ComplianceBadge label="PCI-DSS" />
      </div>
      <div className="risk-line"><span>Risk Level: Medium</span><div className="risk-fill" /></div>
      <table>
        <thead><tr><th>Who</th><th>What changed</th><th>When</th></tr></thead>
        <tbody>
          <tr><td>Olivia</td><td>Added PHI masking rule</td><td>2026-02-24 14:32</td></tr>
          <tr><td>David</td><td>Updated FINRA disclaimer wording</td><td>2026-02-24 11:10</td></tr>
          <tr><td>System</td><td>Fallback triggered on latency threshold</td><td>2026-02-24 09:55</td></tr>
        </tbody>
      </table>
    </section>
  );
}