import { legalCompanyName, legalContactEmail } from "../../lib/legal";

export const privacyPolicyMarkdown = `# Privacy Policy

**Effective Date:** April 17, 2026

This Privacy Policy explains how **${legalCompanyName}** ("we," "us," or "our") collects, uses, discloses, stores, and safeguards personal information in connection with **GenPromptly**.

**GenPromptly is a product and brand operated by ${legalCompanyName} and is not a separate legal entity.** When this Policy refers to "GenPromptly," it refers to the GenPromptly website, app, related pages, and related services operated by ${legalCompanyName}.

By using GenPromptly, creating an account, submitting prompts, or purchasing a subscription, you acknowledge that you have read this Privacy Policy.

## 1. What GenPromptly does

GenPromptly helps users turn rough prompts into clearer, more structured prompts. To provide this service, we may send all or part of a user's submitted prompt, together with system instructions and relevant processing context, to third-party service providers, including the OpenAI API, to generate an optimized output.

GenPromptly is an AI-assisted tool. It does not guarantee factual accuracy, completeness, or suitability for any particular purpose.

## 2. Information we collect

We may collect the following categories of information:

### A. Account and identity information
- Name
- Email address
- Account identifiers
- Authentication-related metadata

### B. Billing and subscription information
- Customer ID
- Subscription status
- Plan type
- Billing country or region
- Limited payment-related metadata provided by our payment processor

We do **not** directly store full payment card numbers on our own servers.

### C. Prompt and usage information
- Prompts you submit
- Outputs returned by the service
- Usage counts
- Feature interaction data
- Error reports
- Support messages you send us

### D. Technical information
- IP address
- Browser type
- Device information
- Operating system
- Log data
- Analytics and cookie-related data

## 3. How we collect information

We collect information:
- directly from you when you create an account, submit prompts, contact support, or purchase a subscription;
- automatically when you use the website or app;
- from service providers that help us operate the service, such as authentication, hosting, database, analytics, AI, and payment providers.

## 4. Why we use information

We use personal information to:
- create and manage your account;
- provide GenPromptly's prompt optimization service;
- authenticate users and secure accounts;
- process subscriptions and manage billing;
- monitor usage limits, abuse, fraud, and technical issues;
- provide support and respond to inquiries;
- improve performance, reliability, and user experience;
- comply with legal obligations;
- enforce our Terms and protect the rights, safety, and security of our business, users, and service providers.

We do not sell your personal information.

## 5. Service providers and third-party processing

We use third-party service providers to operate GenPromptly. Depending on how the service is configured at the time of use, these providers may process personal information or user-submitted content on our behalf.

Our current or expected categories of service providers include:

- **OpenAI** - to process prompts and generate optimized outputs through the OpenAI API;
- **Stripe** - to process subscription payments, billing, and related payment events;
- **Clerk** (or a similar authentication provider) - to manage authentication and account access;
- **Neon** (or a similar database provider) - to store account, subscription, and application data;
- **Vercel** (or a similar hosting provider) - to host and deliver the website and application;
- analytics, logging, monitoring, email, and customer support providers, if and when used.

These providers may process information in Canada, the United States, or other jurisdictions where they or their infrastructure operate.

## 6. OpenAI API processing

When you submit a prompt to GenPromptly, we may send that prompt, in whole or in part, to the OpenAI API so that an AI model can generate a revised or optimized prompt.

This means:
- your submitted content may be processed by OpenAI;
- prompts and outputs may be subject to OpenAI's own technical, abuse prevention, logging, retention, and security practices;
- we do not control OpenAI's internal retention policies or infrastructure.

Because GenPromptly uses third-party AI services, we recommend that you **do not submit confidential, highly sensitive, regulated, or legally protected information unless you are comfortable with that information being processed by those providers and unless you have the right to submit it**.

## 7. Payments and billing

Payments and subscriptions are processed by Stripe or another payment processor we designate. We do not directly store full payment card details on our own servers.

Stripe may collect and process payment-related information according to its own privacy policy, terms, and compliance obligations.

## 8. Cookies, analytics, and similar technologies

We may use cookies, local storage, analytics tools, and similar technologies to:
- keep you signed in;
- remember preferences;
- understand usage patterns;
- improve performance and reliability;
- detect abuse and fraud.

You may be able to control certain cookies through your browser settings. Disabling some cookies may affect how GenPromptly works.

## 9. Data retention

We retain information for as long as reasonably necessary to:
- provide the service;
- maintain account records;
- administer subscriptions;
- prevent fraud or abuse;
- comply with legal, tax, accounting, and enforcement obligations;
- resolve disputes and enforce agreements.

Retention periods may vary depending on the type of data and the systems involved. Some third-party providers may retain data according to their own policies and technical configurations.

## 10. Security

We use reasonable administrative, technical, and organizational safeguards to protect personal information. However, no system is completely secure, and we cannot guarantee absolute security.

You are responsible for keeping your account credentials secure and for notifying us if you believe your account has been compromised.

## 11. Your choices and rights

Subject to applicable law, you may have the right to:
- access personal information we hold about you;
- request correction of inaccurate personal information;
- request deletion of your account or certain data;
- withdraw consent where processing is based on consent, subject to legal or contractual restrictions;
- opt out of non-essential marketing communications.

To make a privacy request, contact us at **${legalContactEmail}**.

## 12. Children

GenPromptly is not intended for children under the age required to provide meaningful consent under applicable law. If we learn that we have collected personal information from a child inappropriately, we will take reasonable steps to delete it.

## 13. International transfers

Your information may be processed or stored outside your province, territory, or country, including in the United States. Laws in those jurisdictions may differ from the laws where you live.

## 14. Legal disclosures

We may disclose information where reasonably necessary to:
- comply with law, court orders, subpoenas, or lawful requests;
- detect, investigate, or prevent fraud, abuse, or security incidents;
- protect our rights, users, service providers, or the public;
- enforce our Terms or other agreements.

## 15. Changes to this Policy

We may update this Privacy Policy from time to time. If we make material changes, we may post an updated version on the website, update the effective date, or provide other appropriate notice.

Your continued use of GenPromptly after an updated Policy becomes effective means you accept the updated Policy to the extent permitted by law.

## 16. Contact

**GenPromptly**  
Operated by: **${legalCompanyName}**  
General contact: **${legalContactEmail}**  
Privacy contact: **${legalContactEmail}**
`;
