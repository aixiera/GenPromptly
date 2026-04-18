export const legalCompanyName = "Kairui Bi";

export const legalContactEmail = "bia446635@gmail.com";

export const legalContactHref = `mailto:${legalContactEmail}`;

export const privacyEffectiveDate = "Effective Date: April 17, 2026";
export const privacyLastUpdated = "Last Updated: April 17, 2026";

export const termsContactEmail = legalContactEmail;

export const termsEffectiveDate = "Effective Date: April 17, 2026";
export const termsLastUpdated = "Last Updated: April 17, 2026";

export const governingLawVenueClause =
  process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW?.trim() ||
  "These Terms are governed by the laws of the Province of British Columbia and the federal laws of Canada applicable therein, without regard to conflict of law principles. Any dispute arising out of or relating to these Terms or the Service will be submitted to the courts located in British Columbia, Canada, unless applicable law requires otherwise.";

export const governingLawVenuePlaceholder = governingLawVenueClause;
