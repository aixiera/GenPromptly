import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { PageIntro } from "../../../components/public/PageIntro";
import { SectionHeading } from "../../../components/public/SectionHeading";
import { siteContent } from "../../../content/siteContent";

export const metadata: Metadata = {
  title: "GenPromptly | Kairui Bi",
  description: "GenPromptly is a prompt polishing tool built by Kairui Bi as part of a broader AI systems and digital products practice.",
};

export default async function GenPromptlyPage() {
  const identity = await auth();
  const tryHref = identity.userId ? "/app" : siteContent.genpromptly.appHref;

  return (
    <>
      <PageIntro
        eyebrow="GenPromptly"
        title="A focused prompt polishing tool inside a broader founder-led ecosystem"
        description={siteContent.genpromptly.summary}
        actions={
          <>
            <Link href={tryHref} className="brand-button brand-button--primary">
              Try GenPromptly
            </Link>
            <Link href={siteContent.genpromptly.pricingHref} className="brand-button brand-button--ghost">
              View pricing
            </Link>
          </>
        }
      />

      <section className="brand-section">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="What it does"
            title="Turns rough prompts into clearer, more structured prompts"
            description={siteContent.genpromptly.description}
          />
          <div className="brand-grid brand-grid--three">
            {siteContent.genpromptly.featurePoints.map((point) => (
              <article key={point} className="brand-card">
                <p className="brand-card-text">{point}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Before / after"
            title="A simple example of how the prompt gets clearer"
            description="The goal is not to promise perfect output. The goal is to make the instruction more usable."
          />
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
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="Who it’s for"
            title="Useful for people who start with rough intent and need more structure"
            description="GenPromptly is intentionally positioned as a lighter product layer, not the entire identity of the site."
          />
          <div className="brand-grid brand-grid--two">
            {siteContent.genpromptly.audiences.map((item) => (
              <article key={item} className="brand-card brand-card--soft">
                <p className="brand-card-text">{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="brand-section">
        <div className="brand-shell">
          <div className="brand-cta-band">
            <div>
              <p className="brand-section-eyebrow">Fits into the bigger picture</p>
              <h2 className="brand-section-title">GenPromptly can stand alone or support consulting work</h2>
              <p className="brand-section-description">
                It can be used as a self-serve tool, or as part of a broader prompt system, automation workflow, or
                implementation engagement.
              </p>
            </div>
            <div className="brand-cta-actions">
              <Link href="/services" className="brand-button brand-button--ghost">
                See related services
              </Link>
              <Link href={tryHref} className="brand-button brand-button--primary">
                Open the app
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
