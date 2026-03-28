import { legalCompanyName } from "../lib/legal";
import { LegalLinks } from "./legal/LegalLinks";

type AppFooterProps = {
  compact?: boolean;
};

export function AppFooter({ compact = true }: AppFooterProps) {
  return (
    <footer className="app-footer">
      <div className="app-footer-main">
        <div className="app-footer-branding">
          <p className="app-footer-product">GenPromptly</p>
          <p className="muted app-footer-company">&copy; {legalCompanyName}</p>
        </div>
        <LegalLinks compact={compact} />
      </div>
    </footer>
  );
}
