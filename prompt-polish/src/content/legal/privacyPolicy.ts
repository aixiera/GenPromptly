import { legalCompanyName, legalContactEmail } from "../../lib/legal";

export type LegalBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export const privacyPolicySections: LegalSection[] = [
  {
    id: "introduction",
    title: "1) Introduction",
    blocks: [
      {
        type: "paragraph",
        text: `This Privacy Policy explains how GenPromptly (also referred to as Prompt Polish) is operated by ${legalCompanyName} (we, us, or our) and how we collect, use, share, and protect information when organizations and their users access our B2B SaaS prompt engineering and workflow platform.`,
      },
      {
        type: "paragraph",
        text: "This policy is intended for startup-stage operations and is written to be practical and transparent. It should be reviewed by your legal counsel for your specific use case.",
      },
    ],
  },
  {
    id: "information-we-collect",
    title: "2) Information We Collect",
    blocks: [
      {
        type: "paragraph",
        text: "Depending on how the Service is used, we may collect the following categories of information:",
      },
      {
        type: "list",
        items: [
          "Account and identity information, such as name, email address, authentication identifiers, and profile details provided through account setup and sign-in.",
          "Organization and workspace information, such as organization name, slug, workspace settings, role assignments, membership records, and invitation records.",
          "User-submitted content, including project and prompt data, prompt inputs, prompt outputs, prompt versions, template selections, optimization goals, and related workflow content.",
          "System-generated workflow records, including optimization results, audit events, compliance-related metadata, and usage records such as token consumption and model selection metadata where applicable.",
          "Technical and log data, such as IP address, browser type, device identifiers, timestamps, request IDs, and other operational diagnostics.",
          "Cookies and session-related data used to authenticate sessions, preserve settings, and support secure product operation.",
        ],
      },
      {
        type: "paragraph",
        text: "Users may choose to submit confidential or sensitive information in prompts or related content. Customers and users are responsible for assessing whether they have the right and lawful basis to upload such content.",
      },
    ],
  },
  {
    id: "how-we-use-information",
    title: "3) How We Use Information",
    blocks: [
      {
        type: "paragraph",
        text: "We may use collected information to:",
      },
      {
        type: "list",
        items: [
          "Provide, operate, and maintain the Service.",
          "Authenticate users and secure accounts.",
          "Create and manage organization workspaces, memberships, permissions, and invite flows.",
          "Enable collaboration across projects, prompts, and versions.",
          "Run optimization features and related model-assisted workflows.",
          "Support audit logging, usage tracking, and compliance-oriented product features.",
          "Monitor performance, detect abuse, investigate fraud, and improve security.",
          "Communicate service notices, support updates, and other operational messages.",
          "Analyze product usage to improve reliability, usability, and feature quality.",
        ],
      },
    ],
  },
  {
    id: "legal-bases",
    title: "4) Legal Bases for Processing (Where Applicable)",
    blocks: [
      {
        type: "paragraph",
        text: "Where data protection laws require a legal basis, we generally rely on one or more of the following:",
      },
      {
        type: "list",
        items: [
          "Contract: processing necessary to provide the Service under applicable terms.",
          "Legitimate interests: security monitoring, fraud prevention, product analytics, service improvement, and operational administration.",
          "Consent: where specific consent is requested and required by law.",
          "Legal obligations: where processing is needed to comply with applicable laws, regulations, legal process, or enforceable governmental requests.",
        ],
      },
    ],
  },
  {
    id: "how-we-share-information",
    title: "5) How We Share Information",
    blocks: [
      {
        type: "paragraph",
        text: "We do not sell personal information. We may share information in the following circumstances:",
      },
      {
        type: "list",
        items: [
          "Service providers and subprocessors that help us host, secure, operate, and support the Service.",
          "Infrastructure and platform providers used for compute, storage, monitoring, or delivery.",
          "Authentication and identity providers used for sign-in and account security workflows.",
          "Analytics, support, and communications tools where needed for service quality and user support.",
          "Integrated AI/model providers, where prompt content or related metadata may be processed to deliver optimization features.",
          "Legal compliance and protection, including where disclosure is required by law or reasonably necessary to protect rights, safety, and platform integrity.",
          "Business transfers, such as a merger, acquisition, financing, or asset sale, where information may be transferred as part of the transaction subject to applicable safeguards.",
        ],
      },
    ],
  },
  {
    id: "data-retention",
    title: "6) Data Retention",
    blocks: [
      {
        type: "paragraph",
        text: "We aim to minimize unnecessary retention. We typically retain data for as long as needed to provide the Service and for legitimate business purposes such as security, billing, debugging, product operations, and legal compliance.",
      },
      {
        type: "paragraph",
        text: "Retention periods may vary by data type (for example, workspace content, audit logs, and usage records) and by contractual or legal requirements.",
      },
    ],
  },
  {
    id: "security",
    title: "7) Security Measures",
    blocks: [
      {
        type: "paragraph",
        text: "We use administrative, technical, and organizational safeguards intended to protect information against unauthorized access, loss, misuse, and alteration.",
      },
      {
        type: "paragraph",
        text: "No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
      },
    ],
  },
  {
    id: "international-transfers",
    title: "8) International Data Transfers",
    blocks: [
      {
        type: "paragraph",
        text: "Your information may be processed in countries other than your own. Where applicable, we take steps intended to support lawful transfer mechanisms and appropriate safeguards.",
      },
    ],
  },
  {
    id: "user-rights",
    title: "9) User Rights",
    blocks: [
      {
        type: "paragraph",
        text: "Depending on your jurisdiction and role, you may have rights regarding personal information, including rights to access, correct, delete, restrict, object, and request export of certain data.",
      },
      {
        type: "paragraph",
        text: "Because GenPromptly is a B2B workspace product, organization administrators may control many account and workspace-level actions. We may request verification before acting on rights requests.",
      },
    ],
  },
  {
    id: "customer-responsibilities",
    title: "10) Customer and User Responsibilities",
    blocks: [
      {
        type: "paragraph",
        text: "Customers are responsible for managing their users, workspace permissions, and internal data governance. Users are responsible for ensuring they have rights to submit any content to the Service.",
      },
      {
        type: "paragraph",
        text: "Users should avoid submitting regulated or highly sensitive personal information unless they have a valid legal and operational basis to do so. While the Service may provide compliance-oriented features, each customer remains responsible for its own legal and regulatory obligations and internal review processes.",
      },
    ],
  },
  {
    id: "childrens-privacy",
    title: "11) Children's Privacy",
    blocks: [
      {
        type: "paragraph",
        text: "The Service is intended for business and professional use and is not directed to children under 13 (or the minimum age required by local law). If we learn that prohibited child data has been submitted, we may take steps to remove it.",
      },
    ],
  },
  {
    id: "third-party-services",
    title: "12) Third-Party Services and Links",
    blocks: [
      {
        type: "paragraph",
        text: "The Service may include links or integrations with third-party services. Their privacy practices are governed by their own policies, and we encourage customers to review those policies directly.",
      },
    ],
  },
  {
    id: "changes",
    title: "13) Changes to This Policy",
    blocks: [
      {
        type: "paragraph",
        text: "We may update this Privacy Policy from time to time. Material changes may be communicated through the Service or by other appropriate means. Continued use of the Service after updates indicates acceptance of the revised policy where permitted by law.",
      },
    ],
  },
  {
    id: "contact",
    title: "14) Contact Information",
    blocks: [
      {
        type: "paragraph",
        text: `If you have privacy questions or requests, please contact ${legalCompanyName} at ${legalContactEmail}.`,
      },
    ],
  },
];
