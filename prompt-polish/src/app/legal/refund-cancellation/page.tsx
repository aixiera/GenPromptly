import type { Metadata } from "next";
import { LegalMarkdownDocument } from "../../../components/legal/LegalMarkdownDocument";
import { LegalLinks } from "../../../components/legal/LegalLinks";
import { refundCancellationPolicyMarkdown } from "../../../content/legal/refundCancellationPolicyMarkdown";

export const metadata: Metadata = {
  title: "Refund / Cancellation Policy | GenPromptly",
  description: "Refund and cancellation policy for GenPromptly, operated by Kairui Bi.",
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
