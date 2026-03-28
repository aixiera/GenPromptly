import Link from "next/link";

export default function WorkspaceNotFoundPage() {
  return (
    <section className="panel">
      <h2 style={{ marginBottom: "6px" }}>Resource Not Found</h2>
      <p className="muted" style={{ marginBottom: "12px" }}>
        This workspace route is invalid or the requested record was deleted.
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Link href="/app" className="btn primary" style={{ textDecoration: "none" }}>
          Open Workspace
        </Link>
        <Link href="/app/select-org" className="btn ghost" style={{ textDecoration: "none" }}>
          Switch Workspace
        </Link>
      </div>
    </section>
  );
}
