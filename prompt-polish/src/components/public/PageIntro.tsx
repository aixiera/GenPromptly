import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageIntro({ eyebrow, title, description, actions }: PageIntroProps) {
  return (
    <section className="brand-page-intro">
      <div className="brand-shell">
        <div className="brand-page-intro-card">
          <div>
            {eyebrow ? <p className="brand-section-eyebrow">{eyebrow}</p> : null}
            <h1 className="brand-page-title">{title}</h1>
            <p className="brand-page-description">{description}</p>
          </div>
          {actions ? <div className="brand-page-actions">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
