import Image from "next/image";
import Link from "next/link";
import type { ShowcaseItem } from "../../content/siteContent";

type ShowcaseCardProps = {
  item: ShowcaseItem;
};

export function ShowcaseCard({ item }: ShowcaseCardProps) {
  return (
    <article className="brand-card showcase-card">
      {item.imageSrc ? (
        <div className="showcase-card-media">
          <Image
            src={item.imageSrc}
            alt={item.imageAlt ?? item.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      ) : null}
      <div className="showcase-card-body">
        <div className="showcase-card-meta">
          <span className="brand-chip">{item.category}</span>
          <span className="showcase-card-tag">{item.tag}</span>
        </div>
        <h3 className="brand-card-title">{item.title}</h3>
        <p className="brand-card-text">{item.description}</p>
        {item.price || item.status ? (
          <p className="showcase-card-status">{item.price ?? item.status}</p>
        ) : null}
        <Link href={item.href} className="brand-button brand-button--ghost">
          {item.ctaLabel}
        </Link>
      </div>
    </article>
  );
}
