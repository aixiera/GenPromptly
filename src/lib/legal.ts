export const legalCompanyName =
  process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME?.trim() || "OpsForLocal";

export const legalContactEmail =
  process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "opsforlocal@gmail.com";

export const legalContactHref = `mailto:${legalContactEmail}`;

export const privacyEffectiveDate = "Effective Date: March 5, 2026";
export const privacyLastUpdated = "Last Updated: March 5, 2026";

export const termsContactEmail =
  process.env.NEXT_PUBLIC_TERMS_CONTACT_EMAIL?.trim() || legalContactEmail;

export const termsEffectiveDate = "Effective Date: March 5, 2026";
export const termsLastUpdated = "Last Updated: March 5, 2026";

export const governingLawVenueClause =
  process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW?.trim() ||
  "These Terms are governed by the laws of the Province of British Columbia and the federal laws of Canada applicable therein, without regard to conflict of law principles. Any dispute arising out of or relating to these Terms or the Service will be submitted to the courts located in British Columbia, Canada, unless applicable law requires otherwise.";

export const governingLawVenuePlaceholder = governingLawVenueClause;
