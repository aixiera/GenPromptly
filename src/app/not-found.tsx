import Link from "next/link";

export default function RootNotFoundPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <section className="panel" style={{ width: "100%", maxWidth: "760px" }}>
        <h2 style={{ marginBottom: "6px" }}>Page Not Found</h2>
        <p className="muted" style={{ marginBottom: "12px" }}>
          The page you requested is unavailable or has moved.
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/app" className="btn primary" style={{ textDecoration: "none" }}>
            Open Workspace
          </Link>
          <Link href="/" className="btn ghost" style={{ textDecoration: "none" }}>
            Go Home
          </Link>
        </div>
      </section>
    </main>
  );
}
