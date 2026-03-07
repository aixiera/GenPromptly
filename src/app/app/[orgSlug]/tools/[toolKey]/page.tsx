import { redirect } from "next/navigation";
import { requireOrgPageContext } from "../../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../../lib/rbac";
import { getToolWorkflow } from "../../../../../lib/tools/toolRegistry";

type ToolLaunchPageProps = {
  params: Promise<{ orgSlug: string; toolKey: string }>;
  searchParams: Promise<{ projectId?: string }>;
};

export default async function ToolLaunchPage({ params, searchParams }: ToolLaunchPageProps) {
  const { orgSlug, toolKey } = await params;
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

  const workflow = getToolWorkflow(toolKey);
  if (!workflow) {
    const params = new URLSearchParams();
    params.set("invalidSkill", toolKey);
    if (query.projectId?.trim()) {
      params.set("projectId", query.projectId.trim());
    }
    redirect(`/app/${encodeURIComponent(context.membership.orgSlug)}/tools?${params.toString()}`);
  }

  const targetQuery = new URLSearchParams();
  targetQuery.set("skill", workflow.skillKey);
  if (query.projectId?.trim()) {
    targetQuery.set("projectId", query.projectId.trim());
  }

  redirect(`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts/new?${targetQuery.toString()}`);
}
