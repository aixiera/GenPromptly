import { notFound } from "next/navigation";
import { PromptDetailPanel } from "../../../../../components/PromptDetailPanel";
import { requireOrgPageContext } from "../../../../../lib/auth/orgContext";
import { hasPermission, requirePermission } from "../../../../../lib/rbac";
import prisma from "../../../../../lib/db";

type PromptDetailPageProps = {
  params: Promise<{ orgSlug: string; promptId: string }>;
  searchParams: Promise<{ skill?: string; workflow?: string }>;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export default async function PromptDetailPage({ params, searchParams }: PromptDetailPageProps) {
  const { orgSlug, promptId } = await params;
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

  const prompt = await prisma.prompt.findFirst({
    where: {
      id: promptId,
      orgId: context.membership.orgId,
    },
    select: {
      id: true,
      projectId: true,
      templateId: true,
      title: true,
      rawPrompt: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          name: true,
        },
      },
      template: {
        select: {
          key: true,
          name: true,
        },
      },
      versions: {
        where: {
          orgId: context.membership.orgId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          promptId: true,
          orgId: true,
          optimizedPrompt: true,
          keyChanges: true,
          scores: true,
          missingFields: true,
          riskFlags: true,
          mode: true,
          model: true,
          createdAt: true,
        },
      },
    },
  });

  if (!prompt) {
    notFound();
  }

  const versionIds = prompt.versions.map((version) => version.id);
  const optimizeAuditRows =
    versionIds.length > 0
      ? await prisma.auditLog.findMany({
          where: {
            orgId: context.membership.orgId,
            action: "OPTIMIZE_PROMPT",
            resourceType: "PromptVersion",
            resourceId: {
              in: versionIds,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            resourceId: true,
            metadata: true,
          },
        })
      : [];

  const optimizeMetadataByVersionId = new Map<string, Record<string, unknown>>();
  for (const row of optimizeAuditRows) {
    if (optimizeMetadataByVersionId.has(row.resourceId)) {
      continue;
    }
    optimizeMetadataByVersionId.set(row.resourceId, toRecord(row.metadata));
  }

  const canUpdate = hasPermission(context.membership.role, "update_prompt");
  const canDelete = hasPermission(context.membership.role, "delete_prompt");
  const canOptimize = hasPermission(context.membership.role, "optimize_prompt");
  const canExport = hasPermission(context.membership.role, "export_prompt");

  return (
    <PromptDetailPanel
      orgSlug={context.membership.orgSlug}
      prompt={{
        id: prompt.id,
        projectId: prompt.projectId,
        title: prompt.title,
        rawPrompt: prompt.rawPrompt,
        createdAt: prompt.createdAt.toISOString(),
        updatedAt: prompt.updatedAt.toISOString(),
        versions: prompt.versions.map((version) => {
          const metadata = optimizeMetadataByVersionId.get(version.id) ?? {};
          return {
            id: version.id,
            promptId: version.promptId,
            orgId: version.orgId,
            optimizedPrompt: version.optimizedPrompt,
            keyChanges: Array.isArray(version.keyChanges) ? (version.keyChanges as string[]) : [],
            recommendations: toStringArray(metadata.recommendations),
            scores:
              typeof version.scores === "object" && version.scores !== null
                ? (version.scores as {
                    clarity: number;
                    context: number;
                    constraints: number;
                    format: number;
                  })
                : {
                    clarity: 0,
                    context: 0,
                    constraints: 0,
                    format: 0,
                  },
            missingFields: Array.isArray(version.missingFields) ? (version.missingFields as string[]) : [],
            riskFlags: Array.isArray(version.riskFlags) ? (version.riskFlags as string[]) : [],
            structure: toRecord(metadata.structure),
            structuredData: toRecord(metadata.structuredData),
            skillKey: toNullableString(metadata.skillKey),
            toolKey: toNullableString(metadata.toolKey),
            workflowProfile: toNullableString(metadata.workflowProfile),
            mode: version.mode,
            model: version.model,
            createdAt: version.createdAt.toISOString(),
          };
        }),
      }}
      projectName={prompt.project.name}
      templateName={prompt.template?.name ?? null}
      templateKey={prompt.template?.key ?? null}
      initialSkillKey={query.skill?.trim() || query.workflow?.trim() || null}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canOptimize={canOptimize}
      canExport={canExport}
    />
  );
}
