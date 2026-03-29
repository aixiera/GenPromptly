import Link from "next/link";
import { siteContent, getAvailableSocialLinks } from "../../content/siteContent";
import { LegalLinks } from "../legal/LegalLinks";

export function PublicFooter() {
  const socials = getAvailableSocialLinks();

  return (
    <footer className="brand-footer">
      <div className="brand-shell brand-footer-shell">
        <div className="brand-footer-brand">
          <div className="brand-footer-branding">
            <span className="brand-mark">KB</span>
            <div>
              <p className="brand-footer-title">{siteContent.owner.name}</p>
              <p className="brand-footer-copy">
                Practical AI tools, automation systems, and digital products for real use cases.
              </p>
            </div>
          </div>
          <p className="brand-footer-copy">
            Based in {siteContent.owner.location}. Founder-led work across consulting, implementation, demos,
            resources, and focused products such as GenPromptly.
          </p>
        </div>

        <div className="brand-footer-columns">
          <div className="brand-footer-column">
            <p className="brand-footer-heading">Navigate</p>
            {siteContent.nav.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="brand-footer-column">
            <p className="brand-footer-heading">Contact</p>
            <a href={`mailto:${siteContent.owner.email}`}>{siteContent.owner.email}</a>
            <span>{siteContent.owner.location}</span>
            <Link href="/pricing">GenPromptly pricing</Link>
          </div>
          <div className="brand-footer-column">
            <p className="brand-footer-heading">Profiles</p>
            {socials.length > 0 ? (
              socials.map((item) => (
                <a key={item.label} href={item.href} target="_blank" rel="noreferrer">
                  {item.label}
                </a>
              ))
            ) : (
              <span>Social profile links can be added in site content.</span>
            )}
          </div>
        </div>
      </div>
      <div className="brand-shell brand-footer-legal">
        <LegalLinks />
      </div>
    </footer>
  );
}
