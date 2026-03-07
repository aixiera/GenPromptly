import type { Metadata } from "next";
import { LegalDocumentLayout } from "../../../components/legal/LegalDocumentLayout";
import { LegalLinks } from "../../../components/legal/LegalLinks";
import { termsOfServiceSections } from "../../../content/legal/termsPlaceholder";
import { termsEffectiveDate, termsLastUpdated } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | GenPromptly",
  description:
    "Terms of Service for GenPromptly, a B2B SaaS prompt operations platform operated by OpsForLocal.",
};

export default function TermsPage() {
  return (
    <>
      <LegalDocumentLayout
        title="Terms of Service"
        effectiveDate={termsEffectiveDate}
        lastUpdated={termsLastUpdated}
        intro="These Terms apply to GenPromptly and govern use of the service by business customers, workspace owners, and invited team members."
        sections={termsOfServiceSections}
      />
      <div style={{ display: "grid", placeItems: "center", padding: "0 24px 24px 24px" }}>
        <LegalLinks compact />
      </div>
    </>
  );
}
