import type { ComplianceReport } from "../lib/compliance/types";

type ModelCompareProps = {
  report: ComplianceReport | null;
  isLoading: boolean;
  error: string | null;
};

function formatLatency(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(costUsdPer1kTokens: number): string {
  return `$${costUsdPer1kTokens.toFixed(4)} / 1K tokens`;
}

export function ModelCompare({ report, isLoading, error }: ModelCompareProps) {
  const models = report?.modelProfiles ?? [];

  return (
    <section className="panel">
      <h2>Model Compare</h2>
      {isLoading ? <p className="muted">Loading model profile data...</p> : null}
      {error ? <p className="muted">{error}</p> : null}
      {!isLoading && !error && models.length === 0 ? (
        <p className="muted">No model profile data available yet.</p>
      ) : null}
      <div className="compare-grid">
        {models.map((m) => (
          <article className="compare-card" key={m.id}>
            <h3>{m.name}</h3>
            <div className="output-box">{m.notes}</div>
            <ul>
              <li>Token Cost: {formatCost(m.costUsdPer1kTokens)}</li>
              <li>Latency: {formatLatency(m.latencyMs)}</li>
              <li>Quality Score: {m.schemaAdherence}</li>
              <li>Compliance Friendliness: {m.complianceFriendliness}</li>
              <li>Output Control: {m.outputControl}</li>
            </ul>
            <label>Fallback model</label>
            <select disabled>
              <option>{m.fallbackReadiness}</option>
            </select>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ModelCompare;
