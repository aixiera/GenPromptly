import Link from "next/link";
import prisma from "../../../../lib/db";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../lib/rbac";
import { PageHeader } from "../../../../components/PageHeader";

type PromptsPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ projectId?: string }>;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function deriveRecentOptimizeStatus(version: { riskFlags: unknown; missingFields: unknown } | null) {
  if (!version) {
    return "NOT_RUN" as const;
  }
  const riskFlags = asStringArray(version.riskFlags);
  const missingFields = asStringArray(version.missingFields);
  return riskFlags.length > 0 || missingFields.length > 0 ? "WARN" : "PASS";
}

export default async function PromptsPage({ params, searchParams }: PromptsPageProps) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const context = await requireOrgPageContext(orgSlug);
  requirePermission(
    {
      role: context.membership.role,
      orgId: context.membership.orgId,
      userId: context.user.id,
    },
    "view_prompt"
  );

  const projects = await prisma.project.findMany({
    where: {
      orgId: context.membership.orgId,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });
  const requestedProjectId = query.projectId?.trim() || "";
  const hasProjectFilter = projects.some((project) => project.id === requestedProjectId);
  const activeProjectId = hasProjectFilter ? requestedProjectId : "";

  const prompts = await prisma.prompt.findMany({
    where: {
      orgId: context.membership.orgId,
      ...(activeProjectId ? { projectId: activeProjectId } : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      template: {
        select: {
          id: true,
          name: true,
          key: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          versions: true,
        },
      },
      versions: {
        where: {
          orgId: context.membership.orgId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          riskFlags: true,
          missingFields: true,
        },
      },
    },
  });

  return (
    <section className="panel">
      <PageHeader
        title="Prompts"
        description="Browse prompt workflows, version history, and recent optimization status."
        actions={(
          <Link
            href={`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts/new`}
            className="btn primary"
            style={{ textDecoration: "none" }}
          >
            Open Workflow
          </Link>
        )}
      />

      <form method="GET" style={{ display: "flex", gap: "8px", alignItems: "end", flexWrap: "wrap", marginBottom: "12px" }}>
        <label style={{ display: "grid", gap: "4px", minWidth: "240px" }}>
          <span className="muted">Project filter</span>
          <select name="projectId" defaultValue={activeProjectId} style={{ marginBottom: 0 }}>
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn ghost">
          Apply Filter
        </button>
        {activeProjectId ? (
          <Link href={`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts`} className="btn ghost" style={{ textDecoration: "none" }}>
            Clear Filter
          </Link>
        ) : null}
      </form>

      {prompts.length === 0 ? (
        <div className="card-block">
          <p style={{ marginBottom: "6px" }}>No prompts yet.</p>
          <p className="muted" style={{ margin: 0 }}>
            {activeProjectId
              ? "This project has no prompts yet. Create one to start building optimized prompt workflows."
              : "Create your first prompt to start building optimized prompt workflows."}
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Template</th>
              <th>Updated</th>
              <th>Versions</th>
              <th>Recent Optimize</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((prompt) => {
              const latestVersion = prompt.versions[0] ?? null;
              const status = deriveRecentOptimizeStatus(latestVersion);
              return (
                <tr key={prompt.id}>
                  <td>{prompt.title}</td>
                  <td>{prompt.project.name}</td>
                  <td>{prompt.template?.name ?? "None"}</td>
                  <td>{new Date(prompt.updatedAt).toLocaleString()}</td>
                  <td>{prompt._count.versions}</td>
                  <td>
                    <span className="badge">
                      {status === "NOT_RUN"
                        ? "Not run"
                        : status === "PASS"
                          ? `Pass${latestVersion ? ` (${new Date(latestVersion.createdAt).toLocaleDateString()})` : ""}`
                          : `Warn${latestVersion ? ` (${new Date(latestVersion.createdAt).toLocaleDateString()})` : ""}`}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts/${encodeURIComponent(prompt.id)}`}
                      className="btn ghost"
                      style={{ textDecoration: "none" }}
                    >
                      Open Prompt Workflow
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
