import { PromptCreateFlow } from "../../../../../components/PromptCreateFlow";
import { requireOrgPageContext } from "../../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../../lib/rbac";
import prisma from "../../../../../lib/db";
import { getSkillByRouteKey, getSkillDefinition, resolveSkillDefinition } from "../../../../../lib/tools/toolRegistry";

type NewPromptPageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ projectId?: string; skill?: string; tool?: string; template?: string }>;
};

export default async function NewPromptPage({ params, searchParams }: NewPromptPageProps) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const context = await requireOrgPageContext(orgSlug);
  requirePermission(
    {
      role: context.membership.role,
      orgId: context.membership.orgId,
      userId: context.user.id,
    },
    "create_prompt"
  );

  const [projects, templates] = await Promise.all([
    prisma.project.findMany({
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
    }),
    prisma.template.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        name: true,
        key: true,
        category: true,
      },
    }),
  ]);

  const requestedProjectId = query.projectId?.trim() || null;
  const requestedSkillKey = query.skill?.trim() || "";
  const requestedToolKey = query.tool?.trim() || "";
  const requestedTemplateKey = query.template?.trim() || "";
  const workflow = resolveSkillDefinition({
    skillKey: requestedSkillKey,
    toolKey: requestedToolKey,
    routeKey: requestedToolKey,
    templateKey: requestedTemplateKey,
  });

  const initialProjectId = projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId
    : projects[0]?.id ?? null;
  const selectedTemplate = workflow
    ? templates.find((template) => template.key === workflow.templateKey) ?? null
    : templates.find((template) => template.key === requestedTemplateKey) ?? null;
  const initialTemplateId = selectedTemplate?.id ?? null;
  const warningMessages: string[] = [];

  if (requestedProjectId && !projects.some((project) => project.id === requestedProjectId)) {
    warningMessages.push("Requested project was not found in this workspace. A default project was selected.");
  }
  if (requestedSkillKey && !getSkillDefinition(requestedSkillKey)) {
    warningMessages.push(`Unknown skill key "${requestedSkillKey}" was ignored.`);
  }
  if (requestedToolKey && !getSkillByRouteKey(requestedToolKey)) {
    warningMessages.push(`Unknown workflow key "${requestedToolKey}" was ignored.`);
  }
  if (requestedTemplateKey && !templates.some((template) => template.key === requestedTemplateKey)) {
    warningMessages.push(`Unknown template key "${requestedTemplateKey}" was ignored.`);
  }
  const contextWarning = warningMessages.length > 0 ? warningMessages.join(" ") : null;

  return (
    <PromptCreateFlow
      orgSlug={context.membership.orgSlug}
      projects={projects}
      templates={templates}
      initialProjectId={initialProjectId}
      initialTemplateId={initialTemplateId}
      initialSkillKey={workflow?.skillKey ?? null}
      templateLocked={Boolean(workflow)}
      contextWarning={contextWarning}
    />
  );
}
