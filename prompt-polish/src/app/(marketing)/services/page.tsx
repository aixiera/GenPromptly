import type { Metadata } from "next";
import Link from "next/link";
import { OfferCard } from "../../../components/public/OfferCard";
import { PageIntro } from "../../../components/public/PageIntro";
import { SectionHeading } from "../../../components/public/SectionHeading";
import { ShowcaseCard } from "../../../components/public/ShowcaseCard";
import { siteContent } from "../../../content/siteContent";

export const metadata: Metadata = {
  title: "Services | Kairui Bi",
  description: "AI consulting, workflow implementation, ongoing support, and product offerings from Kairui Bi.",
};

export default function ServicesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Services"
        title="Clear offers for planning, implementation, and follow-through"
        description="The pricing structure is intentionally realistic for a founder-led practice. More complex custom work is scoped after an initial consultation or workflow audit."
        actions={
          <>
            <Link href="/contact" className="brand-button brand-button--primary">
              Start an inquiry
            </Link>
            <Link href="/demo-gallery" className="brand-button brand-button--ghost">
              Explore demos
            </Link>
          </>
        }
      />

      <section className="brand-section">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Pricing ladder"
            title="Consulting and implementation offers"
            description="Use these as starting points rather than rigid agency-style packages. The goal is clarity, not a fake enterprise sales process."
          />
          <div className="brand-grid brand-grid--three">
            {siteContent.serviceOffers.map((offer) => (
              <OfferCard key={offer.title} offer={offer} />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Other ways to work together"
            title="Products and self-serve options that support the consulting side"
            description="These are lighter entry points for people who want a focused tool or resource before engaging a larger project."
          />
          <div className="brand-grid brand-grid--two">
            {siteContent.productOptions.map((item) => (
              <ShowcaseCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
