import Link from "next/link";
import prisma from "../../../../lib/db";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../lib/rbac";
import { PageHeader } from "../../../../components/PageHeader";

type AuditPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 20;

function parseDate(input: string | undefined, endOfDay = false): Date | null {
  if (!input) {
    return null;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (endOfDay) {
    parsed.setUTCHours(23, 59, 59, 999);
  } else {
    parsed.setUTCHours(0, 0, 0, 0);
  }
  return parsed;
}

function safePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

export default async function AuditPage({ params, searchParams }: AuditPageProps) {
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

  const page = safePage(query.page);
  const action = query.action?.trim() || "";
  const from = parseDate(query.from);
  const to = parseDate(query.to, true);
  const where = {
    orgId: context.membership.orgId,
    ...(action ? { action } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [rows, total, distinctActions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        action: true,
        resourceType: true,
        resourceId: true,
        userId: true,
        metadata: true,
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where: { orgId: context.membership.orgId },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;
  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (action) {
      params.set("action", action);
    }
    if (query.from) {
      params.set("from", query.from);
    }
    if (query.to) {
      params.set("to", query.to);
    }
    params.set("page", String(targetPage));
    return `/app/${encodeURIComponent(context.membership.orgSlug)}/audit?${params.toString()}`;
  };

  return (
    <section className="panel">
      <PageHeader
        title="Audit Log"
        description="Review workspace activity history, operational events, and metadata."
      />
      <form method="GET" style={{ display: "flex", gap: "8px", alignItems: "end", flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: "4px" }}>
          <span className="muted">Action</span>
          <select name="action" defaultValue={action} style={{ minWidth: "220px", marginBottom: 0 }}>
            <option value="">All Actions</option>
            {distinctActions.map((entry) => (
              <option key={entry.action} value={entry.action}>
                {entry.action}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: "4px" }}>
          <span className="muted">From</span>
          <input type="date" name="from" defaultValue={query.from ?? ""} />
        </label>
        <label style={{ display: "grid", gap: "4px" }}>
          <span className="muted">To</span>
          <input type="date" name="to" defaultValue={query.to ?? ""} />
        </label>
        <button type="submit" className="btn primary">
          Apply Filters
        </button>
      </form>
      <div style={{ marginTop: "12px" }}>
        {rows.length === 0 ? (
          <div className="card-block">
            <p style={{ marginBottom: "6px" }}>No audit events for this filter.</p>
            <p className="muted" style={{ marginBottom: "10px" }}>
              Try a wider date range or run a prompt workflow to generate new activity.
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
                <th>When</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Actor</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.resourceType}:{row.resourceId}
                  </td>
                  <td>{row.userId ?? "system"}</td>
                  <td>
                    <details>
                      <summary className="muted" style={{ cursor: "pointer" }}>
                        View metadata
                      </summary>
                      <pre style={{ maxHeight: "140px", overflow: "auto", marginTop: "8px" }}>
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="row-between" style={{ marginTop: "12px" }}>
        <span className="muted">
          Page {page} of {totalPages} ({total} total)
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {prevPage ? (
            <Link className="btn ghost" href={buildHref(prevPage)} style={{ textDecoration: "none" }}>
              Previous
            </Link>
          ) : null}
          {nextPage ? (
            <Link className="btn ghost" href={buildHref(nextPage)} style={{ textDecoration: "none" }}>
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
