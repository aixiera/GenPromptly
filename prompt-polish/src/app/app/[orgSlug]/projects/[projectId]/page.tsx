import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatePromptForm } from "../../../../../components/CreatePromptForm";
import { PageHeader } from "../../../../../components/PageHeader";
import { ProjectSettingsActions } from "../../../../../components/ProjectSettingsActions";
import { PromptQuickActions } from "../../../../../components/PromptQuickActions";
import { requireOrgPageContext } from "../../../../../lib/auth/orgContext";
import { hasPermission, requirePermission } from "../../../../../lib/rbac";
import { getProjectById, listPromptsByProject } from "../../../../../lib/tenantData";
import prisma from "../../../../../lib/db";

type ProjectDetailPageProps = {
  params: Promise<{ orgSlug: string; projectId: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { orgSlug, projectId } = await params;
  const context = await requireOrgPageContext(orgSlug);
  requirePermission(
    {
      role: context.membership.role,
      orgId: context.membership.orgId,
      userId: context.user.id,
    },
    "view_project"
  );

  const project = await getProjectById(context.membership.orgId, projectId);
  if (!project) {
    notFound();
  }

  const prompts = await listPromptsByProject(context.membership.orgId, projectId);
  const promptIds = prompts.map((entry) => entry.id);
  const versionCounts = promptIds.length
    ? await prisma.promptVersion.groupBy({
        by: ["promptId"],
        where: {
          orgId: context.membership.orgId,
          promptId: {
            in: promptIds,
          },
        },
        _count: {
          _all: true,
        },
      })
    : [];
  const versionsByPrompt = new Map(versionCounts.map((entry) => [entry.promptId, entry._count._all]));
  const canUpdateProject = hasPermission(context.membership.role, "update_project");
  const canDeleteProject = hasPermission(context.membership.role, "delete_project");

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <section className="panel">
        <PageHeader
          title={project.name}
          description={`Project workspace for prompts, versions, and quick optimize actions. Project ID: ${project.id}`}
          actions={(
            <Link
              className="btn ghost"
              href={`/app/${encodeURIComponent(context.membership.orgSlug)}/projects`}
              style={{ textDecoration: "none" }}
            >
              Back to Projects
            </Link>
          )}
        />
      </section>

      <ProjectSettingsActions
        projectId={project.id}
        orgSlug={context.membership.orgSlug}
        initialName={project.name}
        canUpdate={canUpdateProject}
        canDelete={canDeleteProject}
      />

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Create Prompt</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Create a new prompt in this project, then open it to optimize and review versions.
        </p>
        <CreatePromptForm projectId={project.id} orgSlug={context.membership.orgSlug} />
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Prompts</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Prompt list for this project with quick optimize and export actions.
        </p>
        {prompts.length === 0 ? (
          <p className="muted">No prompts in this project yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Updated</th>
                <th>Versions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((prompt) => (
                <tr key={prompt.id}>
                  <td>{prompt.title}</td>
                  <td>{new Date(prompt.updatedAt).toLocaleString()}</td>
                  <td>{versionsByPrompt.get(prompt.id) ?? 0}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <Link
                        className="btn ghost"
                        href={`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts/${encodeURIComponent(prompt.id)}`}
                        style={{ textDecoration: "none" }}
                      >
                        Open Prompt Workflow
                      </Link>
                      <PromptQuickActions promptId={prompt.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
