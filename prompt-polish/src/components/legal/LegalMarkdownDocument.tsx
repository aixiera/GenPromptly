type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "subheading"; text: string };

type MarkdownSection = {
  id: string;
  title: string;
  blocks: MarkdownBlock[];
};

type ParsedMarkdownDocument = {
  title: string;
  intro: MarkdownBlock[];
  sections: MarkdownSection[];
};

type LegalMarkdownDocumentProps = {
  markdown: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseMarkdownDocument(markdown: string): ParsedMarkdownDocument {
  const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let index = 0;
  let title = "Legal Document";

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      index += 1;
      break;
    }
    index += 1;
  }

  const intro: MarkdownBlock[] = [];
  const sections: MarkdownSection[] = [];
  let currentSection: MarkdownSection | null = null;

  const pushParagraph = (target: MarkdownBlock[], startAt: number): number => {
    const paragraphLines: string[] = [];
    let cursor = startAt;
    while (cursor < lines.length) {
      const raw = lines[cursor];
      const trimmed = raw.trim();
      if (
        !trimmed ||
        trimmed.startsWith("## ") ||
        trimmed.startsWith("### ") ||
        trimmed.startsWith("- ")
      ) {
        break;
      }
      paragraphLines.push(raw);
      cursor += 1;
    }
    if (paragraphLines.length > 0) {
      target.push({
        type: "paragraph",
        text: paragraphLines.join("\n"),
      });
    }
    return cursor;
  };

  const pushList = (target: MarkdownBlock[], startAt: number): number => {
    const items: string[] = [];
    let cursor = startAt;
    while (cursor < lines.length) {
      const trimmed = lines[cursor].trim();
      if (!trimmed.startsWith("- ")) {
        break;
      }
      items.push(trimmed.slice(2));
      cursor += 1;
    }
    if (items.length > 0) {
      target.push({ type: "list", items });
    }
    return cursor;
  };

  while (index < lines.length) {
    const raw = lines[index];
    const trimmed = raw.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const heading = trimmed.slice(3).trim();
      currentSection = {
        id: slugify(heading),
        title: heading,
        blocks: [],
      };
      sections.push(currentSection);
      index += 1;
      continue;
    }

    const target = currentSection ? currentSection.blocks : intro;

    if (trimmed.startsWith("### ")) {
      target.push({ type: "subheading", text: trimmed.slice(4).trim() });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      index = pushList(target, index);
      continue;
    }

    index = pushParagraph(target, index);
  }

  return { title, intro, sections };
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return <strong key={`strong-${idx}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`text-${idx}`}>{part}</span>;
  });
}

function renderBlock(block: MarkdownBlock, key: string) {
  if (block.type === "subheading") {
    return (
      <h3 key={key} style={{ marginBottom: "8px", fontSize: "20px", lineHeight: 1.35 }}>
        {renderInlineMarkdown(block.text)}
      </h3>
    );
  }

  if (block.type === "list") {
    return (
      <ul key={key}>
        {block.items.map((item, idx) => (
          <li key={`${key}-item-${idx}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
  }

  return (
    <p key={key} style={{ whiteSpace: "pre-line" }}>
      {renderInlineMarkdown(block.text)}
    </p>
  );
}

export function LegalMarkdownDocument({ markdown }: LegalMarkdownDocumentProps) {
  const parsed = parseMarkdownDocument(markdown);

  return (
    <main className="legal-page">
      <section className="panel legal-panel">
        <header style={{ marginBottom: "16px" }}>
          <h1 className="legal-title">{parsed.title}</h1>
        </header>

        {parsed.sections.length > 0 ? (
          <nav className="legal-toc" aria-label="Table of contents">
            <h2>Contents</h2>
            <ol>
              {parsed.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="legal-content">
          {parsed.intro.length > 0 ? (
            <section className="legal-section">
              {parsed.intro.map((block, idx) => renderBlock(block, `intro-${idx}`))}
            </section>
          ) : null}
          {parsed.sections.map((section) => (
            <section key={section.id} id={section.id} className="legal-section">
              <h2>{renderInlineMarkdown(section.title)}</h2>
              {section.blocks.map((block, idx) => renderBlock(block, `${section.id}-${idx}`))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

