import Link from "next/link";
import { siteContent } from "../../content/siteContent";

type PublicHeroProps = {
  genpromptlyHref: string;
};

export function PublicHero({ genpromptlyHref }: PublicHeroProps) {
  return (
    <section className="brand-hero">
      <div className="brand-shell brand-hero-grid">
        <div className="brand-hero-copy">
          <p className="brand-section-eyebrow">Founder website</p>
          <h1 className="brand-display">{siteContent.hero.headline}</h1>
          <p className="brand-body-lg">{siteContent.hero.subheadline}</p>
          <div className="brand-chip-list">
            {siteContent.hero.chips.map((chip) => (
              <span key={chip} className="brand-chip">
                {chip}
              </span>
            ))}
          </div>
          <div className="brand-hero-actions">
            <Link href={siteContent.hero.primaryCta.href} className="brand-button brand-button--primary">
              {siteContent.hero.primaryCta.label}
            </Link>
            <Link href={siteContent.hero.secondaryCta.href} className="brand-button brand-button--ghost">
              {siteContent.hero.secondaryCta.label}
            </Link>
            <Link href={genpromptlyHref} className="brand-inline-link">
              {siteContent.hero.tertiaryCta.label}
            </Link>
          </div>
        </div>

        <div className="brand-hero-panel">
          <article className="brand-card brand-card--dark">
            <p className="hero-panel-label">Current positioning</p>
            <h2 className="hero-panel-title">
              Personal brand, consulting capability, demos, resources, and a focused product layer.
            </h2>
            <div className="hero-panel-grid">
              <div>
                <p className="hero-panel-value">Consulting</p>
                <span>Strategy, audits, implementation direction</span>
              </div>
              <div>
                <p className="hero-panel-value">Systems</p>
                <span>n8n workflows, prompt systems, internal tools</span>
              </div>
              <div>
                <p className="hero-panel-value">Products</p>
                <span>GenPromptly and practical digital resources</span>
              </div>
              <div>
                <p className="hero-panel-value">Availability</p>
                <span>{siteContent.owner.availability}</span>
              </div>
            </div>
          </article>

          <div className="hero-panel-stack">
            <article className="brand-card">
              <p className="hero-panel-label">Selected credibility</p>
              <ul className="brand-list hero-panel-list">
                <li>Strong academic and research background</li>
                <li>Community leadership and tech support experience</li>
                <li>Early client work delivered with grounded scope</li>
              </ul>
            </article>
            <article className="brand-card brand-card--soft">
              <p className="hero-panel-label">Featured product</p>
              <h3 className="brand-card-title">GenPromptly</h3>
              <p className="brand-card-text">
                A prompt optimization tool that sits inside a broader founder-led ecosystem of practical AI work.
              </p>
              <Link href="/genpromptly" className="brand-inline-link">
                Learn more
              </Link>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
