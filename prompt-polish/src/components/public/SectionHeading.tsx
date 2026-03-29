type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div className={`brand-section-heading brand-section-heading--${align}`}>
      {eyebrow ? <p className="brand-section-eyebrow">{eyebrow}</p> : null}
      <h2 className="brand-section-title">{title}</h2>
      {description ? <p className="brand-section-description">{description}</p> : null}
    </div>
  );
}
