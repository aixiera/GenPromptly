import type { Metadata } from "next";
import { LegalMarkdownDocument } from "../../../components/legal/LegalMarkdownDocument";
import { LegalLinks } from "../../../components/legal/LegalLinks";
import { privacyPolicyMarkdown } from "../../../content/legal/privacyPolicyMarkdown";

export const metadata: Metadata = {
  title: "Privacy Policy | GenPromptly",
  description:
    "Privacy Policy for GenPromptly, a B2B SaaS prompt operations platform operated by OpsForLocal.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <LegalMarkdownDocument markdown={privacyPolicyMarkdown} />
      <div style={{ display: "grid", placeItems: "center", padding: "0 24px 24px 24px" }}>
        <LegalLinks compact />
      </div>
    </>
  );
}
