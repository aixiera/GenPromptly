import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { OfferCard } from "../../components/public/OfferCard";
import { PublicHero } from "../../components/public/PublicHero";
import { SectionHeading } from "../../components/public/SectionHeading";
import { ShowcaseCard } from "../../components/public/ShowcaseCard";
import { getBookingHref, siteContent } from "../../content/siteContent";

export const metadata: Metadata = {
  title: "Kairui Bi",
  description: siteContent.seo.description,
};

export default async function HomePage() {
  const identity = await auth();
  const genpromptlyHref = identity.userId ? "/app" : siteContent.genpromptly.appHref;

  return (
    <>
      <PublicHero genpromptlyHref={genpromptlyHref} />

      <section className="brand-section">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="What I do"
            title="A founder-led mix of consulting, systems work, and focused products"
            description="The site is structured around Kairui Bi as the operator and builder, with GenPromptly as one part of a broader practical AI business."
          />
          <div className="brand-grid brand-grid--four">
            {siteContent.whatIDo.map((item) => (
              <article key={item.title} className="brand-card">
                <h3 className="brand-card-title">{item.title}</h3>
                <p className="brand-card-text">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Selected focus areas"
            title="Use cases grounded in workflows, not generic AI talk"
            description="These are the kinds of problems, systems, and product ideas I’m most interested in shaping."
          />
          <div className="brand-chip-list">
            {siteContent.focusAreas.map((area) => (
              <span key={area} className="brand-chip">
                {area}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Why work with me"
            title="Credibility through substance, not inflated claims"
            description="The positioning here is intentionally grounded: founder-led, technical, product-aware, and practical about real constraints."
          />
          <div className="brand-grid brand-grid--four">
            {siteContent.credibility.map((item) => (
              <article key={item.title} className="brand-card brand-card--soft">
                <h3 className="brand-card-title">{item.title}</h3>
                <p className="brand-card-text">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <div className="brand-section-row">
            <SectionHeading
              eyebrow="Services preview"
              title="Clear offers with realistic starting points"
              description="The structure is designed for a solo founder and early-stage consultant: small entry points, scoped builds, and room for custom work after consultation."
            />
            <Link href="/services" className="brand-inline-link">
              View all services
            </Link>
          </div>
          <div className="brand-grid brand-grid--three">
            {siteContent.serviceOffers.slice(0, 3).map((offer) => (
              <OfferCard key={offer.title} offer={offer} />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <div className="brand-section-row">
            <SectionHeading
              eyebrow="Demo gallery"
              title="Examples of the kinds of systems I can design or implement"
              description="These are demos, concepts, prototypes, or case-style examples. They are not presented as fake client success stories."
            />
            <Link href="/demo-gallery" className="brand-inline-link">
              Explore the full gallery
            </Link>
          </div>
          <div className="brand-grid brand-grid--three">
            {siteContent.demos.slice(0, 3).map((item) => (
              <ShowcaseCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <div className="brand-section-row">
            <SectionHeading
              eyebrow="Digital resources"
              title="Self-serve materials designed to make implementation clearer"
              description="A smaller library of practical templates, guides, packs, and blueprints can sit alongside consulting and product work."
            />
            <Link href="/digital-resources" className="brand-inline-link">
              Browse resources
            </Link>
          </div>
          <div className="brand-grid brand-grid--three">
            {siteContent.resources.slice(0, 3).map((item) => (
              <ShowcaseCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <div className="brand-highlight">
            <div>
              <p className="brand-section-eyebrow">GenPromptly</p>
              <h2 className="brand-section-title">
                A lightweight prompt polishing tool inside the broader ecosystem
              </h2>
              <p className="brand-section-description">
                {siteContent.genpromptly.summary} {siteContent.genpromptly.description}
              </p>
              <div className="brand-hero-actions">
                <Link href="/genpromptly" className="brand-button brand-button--primary">
                  See GenPromptly
                </Link>
                <Link href={genpromptlyHref} className="brand-button brand-button--ghost">
                  Try GenPromptly
                </Link>
              </div>
            </div>
            <div className="brand-before-after">
              <article className="brand-card brand-card--soft">
                <p className="offer-card-label">Before</p>
                <p className="brand-card-text brand-code-block">{siteContent.genpromptly.before}</p>
              </article>
              <article className="brand-card">
                <p className="offer-card-label">After</p>
                <p className="brand-card-text brand-code-block">{siteContent.genpromptly.after}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-section brand-section--muted">
        <div className="brand-shell brand-story-grid">
          <div className="brand-portrait-frame">
            <Image
              src={siteContent.owner.profileImage}
              alt={siteContent.owner.profileImageAlt}
              fill
              sizes="(max-width: 900px) 100vw, 40vw"
            />
          </div>
          <div className="brand-story-copy">
            <SectionHeading
              eyebrow="Background"
              title="Research-minded, systems-oriented, and interested in practical technology"
              description={siteContent.about.story}
            />
            <p className="brand-card-text">{siteContent.about.intro}</p>
            <p className="brand-card-text">{siteContent.homeStoryPreview}</p>
            <div className="brand-hero-actions">
              <Link href="/about" className="brand-button brand-button--primary">
                Read about me
              </Link>
              <Link href="/background" className="brand-button brand-button--ghost">
                View background
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <div className="brand-cta-band">
            <div>
              <p className="brand-section-eyebrow">Contact / book</p>
              <h2 className="brand-section-title">Ready to talk through a workflow, tool, or product idea?</h2>
              <p className="brand-section-description">
                Start with a consultation, ask about implementation, or reach out directly about GenPromptly, demo
                work, and digital resources.
              </p>
            </div>
            <div className="brand-cta-actions">
              <Link href="/contact" className="brand-button brand-button--primary">
                Contact / book
              </Link>
              <a href={getBookingHref()} className="brand-button brand-button--ghost">
                Send email inquiry
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
