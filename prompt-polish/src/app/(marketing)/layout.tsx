import type { ReactNode } from "react";
import { PublicFooter } from "../../components/public/PublicFooter";
import { PublicNavbar } from "../../components/public/PublicNavbar";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="brand-site">
      <PublicNavbar />
      <main className="brand-main">{children}</main>
      <PublicFooter />
    </div>
  );
}
