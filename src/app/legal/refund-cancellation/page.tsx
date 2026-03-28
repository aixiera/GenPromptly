import type { Metadata } from "next";
import { LegalMarkdownDocument } from "../../../components/legal/LegalMarkdownDocument";
import { LegalLinks } from "../../../components/legal/LegalLinks";
import { refundCancellationPolicyMarkdown } from "../../../content/legal/refundCancellationPolicyMarkdown";

export const metadata: Metadata = {
  title: "Refund / Cancellation Policy | GenPromptly",
  description:
    "Refund / Cancellation Policy for GenPromptly, a B2B SaaS prompt operations platform operated by OpsForLocal.",
};

export default function RefundCancellationPolicyPage() {
  return (
    <>
      <LegalMarkdownDocument markdown={refundCancellationPolicyMarkdown} />
      <div style={{ display: "grid", placeItems: "center", padding: "0 24px 24px 24px" }}>
        <LegalLinks compact />
      </div>
    </>
  );
}

