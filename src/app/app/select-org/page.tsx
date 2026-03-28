import Link from "next/link";
import { CreateOrgForm } from "../../../components/CreateOrgForm";
import { AppFooter } from "../../../components/AppFooter";
import { listMembershipsForUser } from "../../../lib/auth/orgContext";
import { requireAuthenticatedUser } from "../../../lib/auth/server";

export default async function SelectOrgPage() {
  const user = await requireAuthenticatedUser();
  const memberships = await listMembershipsForUser(user.id);

  return (
    <main style={{ minHeight: "100vh", padding: "24px", maxWidth: "980px", margin: "0 auto" }}>
      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Select Workspace</h2>
        <p className="muted" style={{ marginBottom: "14px" }}>
          Choose a workspace to continue, or create a new workspace.
        </p>
        {memberships.length === 0 ? (
          <p className="muted">You do not belong to any workspaces yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px", marginBottom: "18px" }}>
            {memberships.map((entry) => (
              <Link
                key={entry.orgId}
                href={`/app/${encodeURIComponent(entry.orgSlug)}/dashboard`}
                className="card-block"
                style={{ display: "block", textDecoration: "none", color: "inherit" }}
              >
                <strong>{entry.orgName}</strong>
                <p className="muted" style={{ margin: "6px 0 0 0" }}>
                  {entry.orgSlug} ({entry.role})
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Create Workspace</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Create a new workspace for your team and switch into it immediately.
        </p>
        <CreateOrgForm />
      </section>
      <AppFooter />
    </main>
  );
}
