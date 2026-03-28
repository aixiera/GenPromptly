import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { LegalLinks } from "../../../components/legal/LegalLinks";

export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/app" />
      <div style={{ marginTop: "14px", maxWidth: "420px", textAlign: "center" }}>
        <p className="muted" style={{ marginBottom: "8px", fontSize: "13px" }}>
          By continuing, you agree to our{" "}
          <Link href="/legal/privacy">Privacy Policy</Link> and{" "}
          <Link href="/legal/terms">Terms of Service</Link>.
        </p>
        <LegalLinks compact />
      </div>
    </main>
  );
}
