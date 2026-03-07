import Link from "next/link";
import { legalContactEmail, legalContactHref } from "../../lib/legal";

type LegalLinksProps = {
  className?: string;
  compact?: boolean;
};

export function LegalLinks({ className, compact = false }: LegalLinksProps) {
  return (
    <div className={className ?? "legal-links"} style={{ fontSize: compact ? "12px" : "13px" }}>
      <Link href="/legal/privacy">Privacy Policy</Link>
      <Link href="/legal/terms">Terms of Service</Link>
      <a href={legalContactHref} title={legalContactEmail}>
        Contact
      </a>
    </div>
  );
}
