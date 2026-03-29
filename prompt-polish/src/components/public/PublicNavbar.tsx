import Link from "next/link";
import { siteContent } from "../../content/siteContent";

export function PublicNavbar() {
  return (
    <header className="brand-nav">
      <div className="brand-shell brand-nav-shell">
        <Link href="/" className="brand-brand">
          <span className="brand-mark">KB</span>
          <span className="brand-brand-copy">
            <strong>{siteContent.owner.name}</strong>
            <span>{siteContent.owner.label}</span>
          </span>
        </Link>

        <nav className="brand-nav-links" aria-label="Primary">
          {siteContent.nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="brand-nav-actions">
          <Link href="/sign-in" className="brand-button brand-button--ghost brand-button--small">
            Sign in
          </Link>
          <Link href="/contact" className="brand-button brand-button--primary brand-button--small">
            Work with me
          </Link>
        </div>

        <details className="brand-nav-mobile">
          <summary>Menu</summary>
          <div className="brand-nav-mobile-panel">
            {siteContent.nav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <div className="brand-nav-mobile-actions">
              <Link href="/sign-in" className="brand-button brand-button--ghost">
                Sign in
              </Link>
              <Link href="/contact" className="brand-button brand-button--primary">
                Work with me
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
