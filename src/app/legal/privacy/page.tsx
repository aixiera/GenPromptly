import type { Metadata } from "next";
import { LegalDocumentLayout } from "../../../components/legal/LegalDocumentLayout";
import { LegalLinks } from "../../../components/legal/LegalLinks";
import { privacyPolicySections } from "../../../content/legal/privacyPolicy";
import { privacyEffectiveDate, privacyLastUpdated } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | GenPromptly",
  description:
    "Privacy Policy for GenPromptly, a B2B SaaS prompt operations platform operated by OpsForLocal.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <LegalDocumentLayout
        title="Privacy Policy"
        effectiveDate={privacyEffectiveDate}
        lastUpdated={privacyLastUpdated}
        intro="This policy applies to GenPromptly and describes how we handle information across account access, workspace collaboration, prompt operations, and compliance-oriented workflows."
        sections={privacyPolicySections}
      />
      <div style={{ display: "grid", placeItems: "center", padding: "0 24px 24px 24px" }}>
        <LegalLinks compact />
      </div>
    </>
  );
}
