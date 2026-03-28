import type { LegalSection } from "../../content/legal/privacyPolicy";

type LegalDocumentLayoutProps = {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: LegalSection[];
  intro?: string;
};

export function LegalDocumentLayout({
  title,
  effectiveDate,
  lastUpdated,
  sections,
  intro,
}: LegalDocumentLayoutProps) {
  return (
    <main className="legal-page">
      <section className="panel legal-panel">
        <header style={{ marginBottom: "16px" }}>
          <h1 className="legal-title">{title}</h1>
          <p className="muted legal-meta">{effectiveDate}</p>
          <p className="muted legal-meta">{lastUpdated}</p>
          {intro ? <p className="legal-intro">{intro}</p> : null}
        </header>

        <nav className="legal-toc" aria-label="Table of contents">
          <h2>Contents</h2>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal-content">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="legal-section">
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => {
                if (block.type === "paragraph") {
                  return <p key={`${section.id}-p-${index}`}>{block.text}</p>;
                }

                return (
                  <ul key={`${section.id}-l-${index}`}>
                    {block.items.map((item) => (
                      <li key={`${section.id}-item-${item}`}>{item}</li>
                    ))}
                  </ul>
                );
              })}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
