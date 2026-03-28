import Link from "next/link";
import { CreateProjectForm } from "../../../../components/CreateProjectForm";
import { PageHeader } from "../../../../components/PageHeader";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../lib/rbac";
import prisma from "../../../../lib/db";

type ProjectsPageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function ProjectsPage({ params }: ProjectsPageProps) {
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

  const projects = await prisma.project.findMany({
    where: {
      orgId: context.membership.orgId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          prompts: true,
        },
      },
    },
  });

  return (
    <section className="panel">
      <PageHeader
        title="Projects"
        description="Organize prompt workflows by project so teams can track work by business objective."
        actions={<CreateProjectForm />}
      />
      {projects.length === 0 ? (
        <div className="card-block">
          <p style={{ marginBottom: "6px" }}>No projects yet.</p>
          <p className="muted" style={{ margin: 0 }}>
            Create your first project to organize prompts and optimization workflows.
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Prompts</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project._count.prompts}</td>
                <td>{new Date(project.createdAt).toLocaleString()}</td>
                <td>{new Date(project.updatedAt).toLocaleString()}</td>
                <td>
                  <Link
                    className="btn ghost"
                    href={`/app/${encodeURIComponent(context.membership.orgSlug)}/projects/${encodeURIComponent(project.id)}`}
                    style={{ textDecoration: "none" }}
                  >
                    Open Project Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
