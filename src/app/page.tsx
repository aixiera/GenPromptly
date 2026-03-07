import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppFooter } from "../components/AppFooter";

export default async function HomePage() {
  const identity = await auth();
  if (identity.userId) {
    redirect("/app");
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <section className="panel" style={{ width: "100%", maxWidth: "780px" }}>
        <h2 style={{ marginBottom: "8px" }}>GenPromptly</h2>
        <p className="muted" style={{ marginBottom: "14px" }}>
          Prompt operations platform by OpsForLocal.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/sign-in" className="btn primary" style={{ textDecoration: "none" }}>
            Sign In
          </Link>
          <Link href="/sign-up" className="btn ghost" style={{ textDecoration: "none" }}>
            Create Account
          </Link>
        </div>
        <AppFooter />
      </section>
    </main>
  );
}
