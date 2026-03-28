import Link from "next/link";
import prisma from "../../../../lib/db";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../lib/rbac";
import { PageHeader } from "../../../../components/PageHeader";

type UsagePageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ days?: string }>;
};

const WINDOW_OPTIONS = [7, 30] as const;

function parseDays(raw: string | undefined): 7 | 30 {
  const parsed = Number.parseInt(raw ?? "30", 10);
  if (parsed === 7) {
    return 7;
  }
  return 30;
}

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

export default async function UsagePage({ params, searchParams }: UsagePageProps) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const days = parseDays(query.days);
  const context = await requireOrgPageContext(orgSlug);
  requirePermission(
    {
      role: context.membership.role,
      orgId: context.membership.orgId,
      userId: context.user.id,
    },
    "view_project"
  );

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const [usageRows, byUserRaw, byTemplateRaw] = await Promise.all([
    prisma.usage.findMany({
      where: {
        orgId: context.membership.orgId,
        createdAt: {
          gte: since,
        },
      },
      select: {
        createdAt: true,
        userId: true,
        tokenIn: true,
        tokenOut: true,
        costUsd: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.usage.groupBy({
      by: ["userId"],
      where: {
        orgId: context.membership.orgId,
        createdAt: {
          gte: since,
        },
      },
      _sum: {
        tokenIn: true,
        tokenOut: true,
        costUsd: true,
      },
      orderBy: {
        _sum: {
          tokenOut: "desc",
        },
      },
      take: 10,
    }),
    prisma.usage.groupBy({
      by: ["templateName"],
      where: {
        orgId: context.membership.orgId,
        createdAt: {
          gte: since,
        },
      },
      _sum: {
        tokenIn: true,
        tokenOut: true,
        costUsd: true,
      },
      orderBy: {
        _sum: {
          tokenOut: "desc",
        },
      },
      take: 12,
    }),
  ]);

  const userIds = byUserRaw.map((entry) => entry.userId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
    : [];
  const usersById = new Map(users.map((entry) => [entry.id, entry]));

  const totalsByDay = new Map<string, { tokenIn: number; tokenOut: number; costUsd: number }>();
  let totalTokenIn = 0;
  let totalTokenOut = 0;
  let totalCostUsd = 0;

  for (const row of usageRows) {
    const dayKey = row.createdAt.toISOString().slice(0, 10);
    const current = totalsByDay.get(dayKey) ?? { tokenIn: 0, tokenOut: 0, costUsd: 0 };
    current.tokenIn += row.tokenIn;
    current.tokenOut += row.tokenOut;
    current.costUsd += toNumber(row.costUsd);
    totalsByDay.set(dayKey, current);

    totalTokenIn += row.tokenIn;
    totalTokenOut += row.tokenOut;
    totalCostUsd += toNumber(row.costUsd);
  }

  const dailyRows = Array.from(totalsByDay.entries())
    .map(([day, totals]) => ({
      day,
      ...totals,
    }))
    .sort((left, right) => left.day.localeCompare(right.day));

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <section className="panel">
        <PageHeader
          title="Usage Insights"
          description="Token usage, request volume, and model activity for this workspace."
          actions={(
            <Link
              href={`/app/${encodeURIComponent(context.membership.orgSlug)}/audit`}
              className="btn ghost"
              style={{ textDecoration: "none" }}
            >
              View Audit Log
            </Link>
          )}
        />
        <form method="GET" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <label htmlFor="days" className="muted" style={{ fontSize: "13px" }}>
            Window
          </label>
          <select id="days" name="days" defaultValue={String(days)} style={{ marginBottom: 0 }}>
            {WINDOW_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option} days
              </option>
            ))}
          </select>
          <button type="submit" className="btn ghost">
            Apply
          </button>
        </form>
        <div className="stats-grid">
          <article className="stat">
            <p>Total Input Tokens</p>
            <h3>{totalTokenIn.toLocaleString()}</h3>
            <span>Last {days} days</span>
          </article>
          <article className="stat">
            <p>Total Output Tokens</p>
            <h3>{totalTokenOut.toLocaleString()}</h3>
            <span>Last {days} days</span>
          </article>
          <article className="stat">
            <p>Total Cost (USD)</p>
            <h3>${totalCostUsd.toFixed(4)}</h3>
            <span>Last {days} days</span>
          </article>
          <article className="stat">
            <p>Total Events</p>
            <h3>{usageRows.length.toLocaleString()}</h3>
            <span>Usage rows</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Daily Totals</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Daily usage totals for the selected reporting window.
        </p>
        {dailyRows.length === 0 ? (
          <div className="card-block">
            <p style={{ marginBottom: "6px" }}>No usage events in this date range.</p>
            <p className="muted" style={{ marginBottom: "10px" }}>
              Run an optimize workflow or update the time window to populate usage history.
            </p>
            <Link
              href={`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts/new`}
              className="btn primary"
              style={{ textDecoration: "none" }}
            >
              Open Workflow
            </Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Input Tokens</th>
                <th>Output Tokens</th>
                <th>Cost USD</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((row) => (
                <tr key={row.day}>
                  <td>{row.day}</td>
                  <td>{row.tokenIn.toLocaleString()}</td>
                  <td>{row.tokenOut.toLocaleString()}</td>
                  <td>${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Top Users</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Highest usage contributors in the selected window.
        </p>
        {byUserRaw.length === 0 ? (
          <p className="muted">No user usage in this range.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Input Tokens</th>
                <th>Output Tokens</th>
                <th>Cost USD</th>
              </tr>
            </thead>
            <tbody>
              {byUserRaw.map((entry) => {
                const user = usersById.get(entry.userId);
                const sum = entry._sum ?? {};
                return (
                  <tr key={entry.userId}>
                    <td>{user?.name ?? entry.userId}</td>
                    <td>{user?.email ?? "-"}</td>
                    <td>{sum.tokenIn?.toLocaleString() ?? "0"}</td>
                    <td>{sum.tokenOut?.toLocaleString() ?? "0"}</td>
                    <td>${toNumber(sum.costUsd).toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Usage by Skill/Template</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Prompt usage distribution by workflow skill and template context.
        </p>
        {byTemplateRaw.length === 0 ? (
          <p className="muted">No skill/template usage in this range.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Skill/Template</th>
                <th>Input Tokens</th>
                <th>Output Tokens</th>
                <th>Cost USD</th>
              </tr>
            </thead>
            <tbody>
              {byTemplateRaw.map((entry) => {
                const sum = entry._sum ?? {};
                return (
                  <tr key={entry.templateName ?? "unscoped"}>
                    <td>{entry.templateName ?? "unscoped"}</td>
                    <td>{sum.tokenIn?.toLocaleString() ?? "0"}</td>
                    <td>{sum.tokenOut?.toLocaleString() ?? "0"}</td>
                    <td>${toNumber(sum.costUsd).toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
