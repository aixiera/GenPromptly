import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "../../../components/public/PageIntro";
import { SectionHeading } from "../../../components/public/SectionHeading";
import { ShowcaseCard } from "../../../components/public/ShowcaseCard";
import { siteContent } from "../../../content/siteContent";

export const metadata: Metadata = {
  title: "Demo Gallery | Kairui Bi",
  description: "Demo gallery of AI workflow concepts, internal tools, and automation examples from Kairui Bi.",
};

export default function DemoGalleryPage() {
  const categories = Array.from(new Set(siteContent.demos.map((item) => item.category)));

  return (
    <>
      <PageIntro
        eyebrow="Demo gallery"
        title="Examples of workflows, tools, and system concepts worth discussing"
        description="This gallery is designed to support credibility without pretending these are large-scale client case studies. The cards below are demos, prototypes, concepts, and case-style examples."
        actions={
          <>
            <Link href="/contact" className="brand-button brand-button--primary">
              Request similar system
            </Link>
            <Link href="/services" className="brand-button brand-button--ghost">
              View services
            </Link>
          </>
        }
      />

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Categories"
            title="The gallery spans several practical use cases"
            description="The emphasis stays on useful workflows, internal tools, and operational clarity."
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
            {siteContent.demos.map((item) => (
              <ShowcaseCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
