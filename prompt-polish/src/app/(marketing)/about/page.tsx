import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageIntro } from "../../../components/public/PageIntro";
import { SectionHeading } from "../../../components/public/SectionHeading";
import { siteContent } from "../../../content/siteContent";

export const metadata: Metadata = {
  title: "About | Kairui Bi",
  description: "About Kairui Bi, a founder-led builder focused on practical AI systems and digital products.",
};

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About"
        title="Founder-led work shaped by systems thinking, research, and practical delivery"
        description="This site is meant to feel like a real personal brand and studio presence: clear enough for clients, grounded enough to trust, and practical enough to support actual work."
        actions={
          <>
            <Link href="/services" className="brand-button brand-button--primary">
              View services
            </Link>
            <Link href="/contact" className="brand-button brand-button--ghost">
              Contact / book
            </Link>
          </>
        }
      />

      <section className="brand-section">
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
              eyebrow="Founder intro"
              title="Useful systems matter more to me than impressive-sounding ones"
              description={siteContent.about.intro}
            />
            <p className="brand-card-text">{siteContent.about.story}</p>
            <p className="brand-card-text">
              I’m especially interested in the point where technical capability, product judgment, and real human
              workflows meet. That usually means scoping carefully, communicating clearly, and resisting the urge to
              oversell what a system can do.
            </p>
          </div>
        </div>
      </section>

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Approach"
            title="How I like to work"
            description="The public positioning is founder-led, product-aware, and careful about scope because that tends to lead to better outcomes than big promises."
          />
          <div className="brand-grid brand-grid--three">
            {siteContent.about.values.map((value) => (
              <article key={value.title} className="brand-card">
                <h3 className="brand-card-title">{value.title}</h3>
                <p className="brand-card-text">{value.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Current focus"
            title="Work I’m actively interested in building and refining"
            description="The emphasis is on practical AI, workflow clarity, and digital products that remain understandable after the first demo."
          />
          <div className="brand-grid brand-grid--two">
            {siteContent.about.currentFocus.map((focus) => (
              <article key={focus} className="brand-card brand-card--soft">
                <p className="brand-card-text">{focus}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
