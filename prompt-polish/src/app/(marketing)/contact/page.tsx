import type { Metadata } from "next";
import Image from "next/image";
import { InquiryForm } from "../../../components/public/InquiryForm";
import { PageIntro } from "../../../components/public/PageIntro";
import { SectionHeading } from "../../../components/public/SectionHeading";
import { getAvailableSocialLinks, getBookingHref, siteContent } from "../../../content/siteContent";

export const metadata: Metadata = {
  title: "Contact | Kairui Bi",
  description: "Contact or book Kairui Bi for consulting, workflow planning, implementation, digital resources, or GenPromptly.",
};

export default function ContactPage() {
  const socials = getAvailableSocialLinks();

  return (
    <>
      <PageIntro
        eyebrow="Contact / book"
        title="Reach out about consulting, implementation, demos, resources, or GenPromptly"
        description="The contact flow is intentionally straightforward: direct email, a structured inquiry form, and a place for additional channels such as WeChat."
        actions={
          <>
            <a href={getBookingHref()} className="brand-button brand-button--primary">
              Book by email
            </a>
            <a href={`mailto:${siteContent.owner.email}`} className="brand-button brand-button--ghost">
              Send direct email
            </a>
          </>
        }
      />

      <section className="brand-section">
        <div className="brand-shell brand-contact-grid">
          <InquiryForm email={siteContent.owner.email} />

          <div className="brand-contact-side">
            <article className="brand-card">
              <p className="brand-section-eyebrow">Direct contact</p>
              <h2 className="brand-card-title">{siteContent.owner.email}</h2>
              <p className="brand-card-text">{siteContent.owner.location}</p>
              <p className="brand-card-text">{siteContent.owner.availability}</p>
            </article>

            <article className="brand-card brand-card--soft">
              <p className="brand-section-eyebrow">WeChat</p>
              <h2 className="brand-card-title">Connect via QR</h2>
              <p className="brand-card-text">
                If WeChat is a better fit, the QR image is already wired into the site and can be used as a secondary
                contact path.
              </p>
              <div className="brand-qr-frame">
                <Image
                  src={siteContent.owner.wechatQrImage}
                  alt="WeChat QR code for Kairui Bi"
                  fill
                  sizes="220px"
                />
              </div>
            </article>

            <article className="brand-card">
              <p className="brand-section-eyebrow">Profiles</p>
              <h2 className="brand-card-title">Additional social links</h2>
              {socials.length > 0 ? (
                <div className="brand-link-list">
                  {socials.map((item) => (
                    <a key={item.label} href={item.href} target="_blank" rel="noreferrer">
                      {item.label}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="brand-card-text">
                  LinkedIn, GitHub, and Instagram placeholders are centralized in the site content file and can be
                  added later without changing the page layout.
                </p>
              )}
            </article>
          </div>
        </div>
      </section>

      <section className="brand-section brand-section--muted">
        <div className="brand-shell">
          <SectionHeading
            eyebrow="FAQ"
            title="A few practical questions people usually ask first"
            description="The answers are meant to keep expectations clear before a call or project scope discussion."
          />
          <div className="brand-grid brand-grid--two">
            {siteContent.contactFaq.map((item) => (
              <article key={item.question} className="brand-card">
                <h3 className="brand-card-title">{item.question}</h3>
                <p className="brand-card-text">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
