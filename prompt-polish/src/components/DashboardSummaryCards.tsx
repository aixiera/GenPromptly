"use client";

import { useDashboardSummary } from "../lib/hooks/useDashboardSummary";

function formatWholeNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercentage(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDelta(deltaPct: number | null | undefined, windowDays: number): string {
  if (typeof deltaPct !== "number" || !Number.isFinite(deltaPct)) {
    return "No prior window";
  }
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}% vs prev ${windowDays}d`;
}

export function DashboardSummaryCards() {
  const { data, isLoading, error } = useDashboardSummary();
  const windowDays = data?.windowDays ?? 7;
  const isNewWorkspace = !isLoading && !!data && data.projectCount === 0 && data.promptCount === 0;

  const stats = [
    {
      label: "Prompts Count",
      value: isLoading ? "..." : formatWholeNumber(data?.metrics.promptsCount.value),
      sub: isLoading ? "Loading..." : formatDelta(data?.metrics.promptsCount.deltaPct, windowDays),
    },
    {
      label: "Optimize Count",
      value: isLoading ? "..." : formatWholeNumber(data?.metrics.optimizeCount.value),
      sub: isLoading ? "Loading..." : formatDelta(data?.metrics.optimizeCount.deltaPct, windowDays),
    },
    {
      label: "Compliance Pass Rate",
      value: isLoading ? "..." : formatPercentage(data?.metrics.compliancePassRate.value),
      sub: isLoading ? "Loading..." : formatDelta(data?.metrics.compliancePassRate.deltaPct, windowDays),
    },
    {
      label: "Model Cost",
      value: isLoading ? "..." : formatCurrency(data?.metrics.modelCostUsd.value),
      sub: isLoading ? "Loading..." : formatDelta(data?.metrics.modelCostUsd.deltaPct, windowDays),
    },
  ];

  return (
    <section className="panel">
      <h2>Workspace Snapshot</h2>
      <div className="stats-grid">
        {stats.map((item) => (
          <article className="stat" key={item.label}>
            <p>{item.label}</p>
            <h3>{item.value}</h3>
            <span>{item.sub}</span>
          </article>
        ))}
      </div>
      {error ? (
        <p className="muted" style={{ marginTop: "10px" }}>
          Unable to load summary metrics right now. Try refreshing in a moment.
        </p>
      ) : null}
      {isNewWorkspace ? (
        <p className="muted" style={{ marginTop: "10px" }}>
          This workspace is new. Create a project and run your first optimize to populate metrics.
        </p>
      ) : null}
    </section>
  );
}
