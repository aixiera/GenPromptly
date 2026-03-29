import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "../../../components/public/PageIntro";
import { SectionHeading } from "../../../components/public/SectionHeading";
import { getResumeHref, siteContent } from "../../../content/siteContent";

export const metadata: Metadata = {
  title: "Background | Kairui Bi",
  description: "Education, leadership, research, and interests that inform Kairui Bi’s founder and consulting work.",
};

export default function BackgroundPage() {
  const resumeHref = getResumeHref();
  const sections = [
    { title: "Education", items: siteContent.background.education },
    { title: "Leadership", items: siteContent.background.leadership },
    { title: "Community & service", items: siteContent.background.community },
    { title: "Research", items: siteContent.background.research },
    { title: "Awards / selected notes", items: siteContent.background.awards },
    { title: "Interests", items: siteContent.background.interests },
  ];

  return (
    <>
      <PageIntro
        eyebrow="Background"
        title="Structured context behind the founder and consulting work"
        description="This page is closer to a background overview than a full resume dump. It highlights the parts of my experience that most directly inform how I build and communicate."
        actions={
          resumeHref ? (
            <a href={resumeHref} className="brand-button brand-button--primary">
              Download resume
            </a>
          ) : (
            <span className="brand-button brand-button--ghost brand-button--disabled">
              Resume download placeholder
            </span>
          )
        }
      />

      <section className="brand-section">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Overview"
            title="Academic, leadership, and research context"
            description="The structure below is easy to expand later with a PDF resume, detailed publication list, or selected awards."
          />
          <div className="brand-grid brand-grid--two">
            {sections.map((section) => (
              <article key={section.title} className="brand-card">
                <h2 className="brand-card-title">{section.title}</h2>
                <ul className="brand-list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <div className="brand-cta-band">
            <div>
              <p className="brand-section-eyebrow">Next step</p>
              <h2 className="brand-section-title">If the background feels aligned, the easiest next step is a call</h2>
              <p className="brand-section-description">
                Use the contact page for consulting inquiries, implementation discussions, or questions about
                products and resources.
              </p>
            </div>
            <div className="brand-cta-actions">
              <Link href="/contact" className="brand-button brand-button--primary">
                Contact / book
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
