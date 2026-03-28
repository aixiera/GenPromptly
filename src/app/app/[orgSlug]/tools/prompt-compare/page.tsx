import Link from "next/link";
import prisma from "../../../../../lib/db";
import { requireOrgPageContext } from "../../../../../lib/auth/orgContext";
import { requirePermission } from "../../../../../lib/rbac";
import { PageHeader } from "../../../../../components/PageHeader";

type PromptComparePageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ promptId?: string }>;
};

export default async function PromptComparePage({ params, searchParams }: PromptComparePageProps) {
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

  const prompts = await prisma.prompt.findMany({
    where: {
      orgId: context.membership.orgId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
    },
    take: 60,
  });

  const requestedPromptId = query.promptId?.trim() || "";
  const selectedPromptId = prompts.some((entry) => entry.id === requestedPromptId)
    ? requestedPromptId
    : prompts[0]?.id ?? "";

  const selectedPrompt = selectedPromptId
    ? await prisma.prompt.findFirst({
        where: {
          id: selectedPromptId,
          orgId: context.membership.orgId,
        },
        select: {
          id: true,
          title: true,
          versions: {
            where: {
              orgId: context.membership.orgId,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 2,
            select: {
              id: true,
              mode: true,
              model: true,
              createdAt: true,
              optimizedPrompt: true,
              scores: true,
              riskFlags: true,
            },
          },
        },
      })
    : null;

  return (
    <section className="panel">
      <PageHeader
        title="Prompt Compare"
        description="Compare recent optimized outputs before rollout decisions."
      />

      {prompts.length === 0 ? (
        <div className="card-block">
          <p style={{ marginBottom: "6px" }}>No prompts available to compare.</p>
          <p className="muted" style={{ marginBottom: "10px" }}>
            Create a prompt and run optimize at least once.
          </p>
          <Link
            href={`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts/new`}
            className="btn primary"
            style={{ textDecoration: "none" }}
          >
            Create Prompt
          </Link>
        </div>
      ) : (
        <>
          <form method="GET" style={{ display: "flex", gap: "8px", alignItems: "end", flexWrap: "wrap", marginBottom: "12px" }}>
            <label style={{ display: "grid", gap: "4px", minWidth: "300px" }}>
              <span className="muted">Prompt</span>
              <select name="promptId" defaultValue={selectedPromptId} style={{ marginBottom: 0 }}>
                {prompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn ghost">
              Compare
            </button>
          </form>

          {selectedPrompt && selectedPrompt.versions.length > 0 ? (
            <div className="compare-grid">
              {selectedPrompt.versions.map((version, index) => (
                <article className="compare-card" key={version.id}>
                  <h3 style={{ marginBottom: "6px" }}>
                    {index === 0 ? "Latest" : "Previous"} version
                  </h3>
                  <p className="muted" style={{ marginBottom: "8px" }}>
                    {new Date(version.createdAt).toLocaleString()} | {version.mode} | {version.model}
                  </p>
                  <div className="output-box" style={{ whiteSpace: "pre-wrap" }}>
                    {version.optimizedPrompt}
                  </div>
                  <p className="muted" style={{ marginBottom: "4px" }}>
                    Risk Flags: {Array.isArray(version.riskFlags) ? version.riskFlags.length : 0}
                  </p>
                  <Link
                    href={`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts/${encodeURIComponent(selectedPrompt.id)}`}
                    className="btn ghost"
                    style={{ textDecoration: "none" }}
                  >
                    Open Prompt Workflow
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="card-block">
              <p style={{ marginBottom: "6px" }}>No versions available for this prompt.</p>
              <p className="muted" style={{ margin: 0 }}>
                Open prompt detail and run optimize to create a comparison baseline.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
