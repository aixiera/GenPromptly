import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { OrgContextSync } from "../../../components/OrgContextSync";
import { OrgSwitcher } from "../../../components/OrgSwitcher";
import { OrgSidebarNav } from "../../../components/OrgSidebarNav";
import { AppFooter } from "../../../components/AppFooter";
import { HttpError } from "../../../lib/api/httpError";
import { requireOrgPageContext } from "../../../lib/auth/orgContext";

type OrgLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  const context = await requireOrgPageContext(orgSlug).catch((err: unknown) => {
    if (err instanceof HttpError && err.status === 404) {
      notFound();
    }
    throw err;
  });

  return (
    <main className="app-shell workspace-app">
      <aside className="sidebar">
        <div className="brand-box">
          <img className="brand-mark" src="/genpromptly-icon.png" alt="GenPromptly icon" />
          <div>
            <p className="brand-title">{context.membership.orgName}</p>
            <p className="brand-subtitle">GenPromptly</p>
          </div>
        </div>
        <OrgSidebarNav orgSlug={context.membership.orgSlug} />
      </aside>
      <section className="content-wrap">
        <OrgContextSync orgId={context.membership.orgId} />
        <header className="topbar">
          <div>
            <h1>{context.membership.orgName}</h1>
            <p>GenPromptly workspace</p>
          </div>
          <div className="workspace-header-actions">
            <Link
              href={`/app/${encodeURIComponent(context.membership.orgSlug)}/prompts/new`}
              className="btn primary"
              style={{ textDecoration: "none" }}
            >
              Create Prompt
            </Link>
            <OrgSwitcher
              currentOrgSlug={context.membership.orgSlug}
              memberships={context.memberships.map((entry) => ({
                orgId: entry.orgId,
                orgSlug: entry.orgSlug,
                orgName: entry.orgName,
                role: entry.role,
              }))}
              manageHref="/app/select-org"
              createHref="/app/select-org"
              showCreateLink={false}
            />
            <Link
              href={`/app/${encodeURIComponent(context.membership.orgSlug)}/team`}
              className="btn ghost"
              style={{ textDecoration: "none" }}
            >
              Team
            </Link>
            <Link
              href={`/app/${encodeURIComponent(context.membership.orgSlug)}/billing`}
              className="btn ghost"
              style={{ textDecoration: "none" }}
            >
              Billing
            </Link>
            <Link href="/classic" className="btn ghost" style={{ textDecoration: "none" }}>
              Legacy Classic View
            </Link>
            <UserButton />
          </div>
        </header>
        {children}
        <AppFooter />
      </section>
    </main>
  );
}
