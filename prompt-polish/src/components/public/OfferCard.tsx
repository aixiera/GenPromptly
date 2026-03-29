import Link from "next/link";
import type { ServiceOffer } from "../../content/siteContent";

type OfferCardProps = {
  offer: ServiceOffer;
};

export function OfferCard({ offer }: OfferCardProps) {
  return (
    <article className="brand-card offer-card">
      <div className="offer-card-header">
        <div>
          <p className="offer-card-kicker">Service offering</p>
          <h3 className="brand-card-title">{offer.title}</h3>
        </div>
        <p className="offer-card-price">{offer.price}</p>
      </div>
      <p className="brand-card-text">{offer.description}</p>
      <div className="offer-card-meta">
        <p className="offer-card-label">Best for</p>
        <p className="brand-card-text">{offer.bestFor}</p>
      </div>
      <div className="offer-card-meta">
        <p className="offer-card-label">What’s included</p>
        <ul className="brand-list">
          {offer.includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="offer-card-meta">
        <p className="offer-card-label">Expected deliverable</p>
        <p className="brand-card-text">{offer.deliverable}</p>
      </div>
      <Link href={offer.href} className="brand-button brand-button--primary">
        {offer.ctaLabel}
      </Link>
    </article>
  );
}
