import type { Metadata } from "next";
import { LegalMarkdownDocument } from "../../../components/legal/LegalMarkdownDocument";
import { LegalLinks } from "../../../components/legal/LegalLinks";
import { termsOfServiceMarkdown } from "../../../content/legal/termsOfServiceMarkdown";

export const metadata: Metadata = {
  title: "Terms of Service | GenPromptly",
  description:
    "Terms of Service for GenPromptly, a B2B SaaS prompt operations platform operated by OpsForLocal.",
};

export default function TermsPage() {
  return (
    <>
      <LegalMarkdownDocument markdown={termsOfServiceMarkdown} />
      <div style={{ display: "grid", placeItems: "center", padding: "0 24px 24px 24px" }}>
        <LegalLinks compact />
      </div>
    </>
  );
}
