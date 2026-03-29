import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "../../../components/public/PageIntro";
import { SectionHeading } from "../../../components/public/SectionHeading";
import { ShowcaseCard } from "../../../components/public/ShowcaseCard";
import { siteContent } from "../../../content/siteContent";

export const metadata: Metadata = {
  title: "Digital Resources | Kairui Bi",
  description: "Templates, guides, prompt packs, and workflow blueprints from Kairui Bi.",
};

export default function DigitalResourcesPage() {
  const categories = ["All", "Templates", "Guides", "Toolkits", "Prompt Packs", "Workflow Blueprints"];

  return (
    <>
      <PageIntro
        eyebrow="Digital resources"
        title="A mini library of practical materials for planning and implementation"
        description="This page is structured like a small digital shop or knowledge library. Some items are ready to release; others are placeholders designed to be easy to publish later."
        actions={
          <>
            <Link href="/contact" className="brand-button brand-button--primary">
              Ask about a resource
            </Link>
            <Link href="/services" className="brand-button brand-button--ghost">
              Need a custom version?
            </Link>
          </>
        }
      />

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Browse"
            title="Categories prepared for a growing resource library"
            description="The UI is structured so these categories can expand without a redesign later."
          />
          <div className="brand-chip-list">
            {categories.map((category) => (
              <span key={category} className="brand-chip">
                {category}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <div className="brand-grid brand-grid--three">
            {siteContent.resources.map((item) => (
              <ShowcaseCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
