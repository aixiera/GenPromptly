import type { LegalSection } from "./privacyPolicy";
import {
  governingLawVenueClause,
  legalCompanyName,
  termsContactEmail,
} from "../../lib/legal";

export const termsOfServiceSections: LegalSection[] = [
  {
    id: "acceptance",
    title: "1) Acceptance of Terms",
    blocks: [
      {
        type: "paragraph",
        text: `These Terms of Service (Terms) govern access to and use of GenPromptly / Prompt Polish (Service), operated by ${legalCompanyName}. By accessing or using the Service, you agree to these Terms. If you are accepting on behalf of an organization, you represent that you have authority to bind that organization.`,
      },
    ],
  },
  {
    id: "description",
    title: "2) Description of the Service",
    blocks: [
      {
        type: "paragraph",
        text: "The Service is a B2B SaaS prompt engineering platform that may include workspaces, projects, prompts, prompt versions, templates, optimization workflows, usage tracking, audit visibility, export functions, compliance-oriented review features, and team invitation/membership tools.",
      },
      {
        type: "paragraph",
        text: "We may update, improve, or modify product features over time.",
      },
    ],
  },
  {
    id: "eligibility",
    title: "3) Eligibility and Accounts",
    blocks: [
      {
        type: "paragraph",
        text: "You must be legally able to enter into these Terms and use the Service for legitimate business purposes.",
      },
      {
        type: "paragraph",
        text: "You are responsible for maintaining account credentials, safeguarding account access, and promptly notifying us of suspected unauthorized use.",
      },
    ],
  },
  {
    id: "workspace-accounts",
    title: "4) Organization / Workspace Accounts",
    blocks: [
      {
        type: "paragraph",
        text: "Workspace owners and admins are responsible for setting access roles, managing invitations, and ensuring appropriate controls for their teams.",
      },
      {
        type: "paragraph",
        text: "Workspace administrators are also responsible for managing offboarding and access revocation for team members when needed.",
      },
    ],
  },
  {
    id: "user-responsibilities",
    title: "5) User Responsibilities",
    blocks: [
      {
        type: "list",
        items: [
          "Use the Service in compliance with applicable laws and regulations.",
          "Provide accurate account information where required.",
          "Use professional judgment and human review before relying on outputs.",
          "Ensure they have rights and permissions for any content submitted to the Service.",
        ],
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "6) Acceptable Use",
    blocks: [
      {
        type: "paragraph",
        text: "You must not use the Service for unlawful, harmful, abusive, fraudulent, infringing, or security-breaking purposes.",
      },
      {
        type: "list",
        items: [
          "Bypass or attempt to bypass workspace isolation, RBAC controls, authentication, rate limits, or platform safeguards.",
          "Probe, scan, or test system vulnerabilities without authorization.",
          "Upload malware or interfere with Service integrity, performance, or availability.",
          "Use the Service to violate privacy rights, intellectual property rights, or contractual obligations.",
        ],
      },
    ],
  },
  {
    id: "customer-content",
    title: "7) Customer Content",
    blocks: [
      {
        type: "paragraph",
        text: "Customer content includes prompts, prompt inputs, prompt outputs, prompt versions, templates, project data, and related workspace submissions.",
      },
      {
        type: "paragraph",
        text: "As between you and us, you retain ownership of your customer content. You grant us a limited, non-exclusive right to host, process, transmit, and use customer content solely as needed to operate, secure, maintain, and improve the Service.",
      },
      {
        type: "paragraph",
        text: "You are responsible for ensuring submitted content does not violate law or third-party rights.",
      },
    ],
  },
  {
    id: "ai-output-limitations",
    title: "8) AI/Model Outputs and Product Limitations",
    blocks: [
      {
        type: "paragraph",
        text: "The Service may rely on integrated AI/model providers to generate or optimize outputs. AI outputs may be inaccurate, incomplete, outdated, or unsuitable for your specific context.",
      },
      {
        type: "paragraph",
        text: "Compliance-related features are assistance tools only. They do not constitute legal advice, certification, or guaranteed regulatory compliance. You are responsible for independent review before relying on any output.",
      },
    ],
  },
  {
    id: "intellectual-property",
    title: "9) Intellectual Property",
    blocks: [
      {
        type: "paragraph",
        text: "The Service, including software, interfaces, branding, and related materials, is owned by or licensed to us and protected by applicable intellectual property laws.",
      },
      {
        type: "paragraph",
        text: "Except for rights expressly granted in these Terms, no other rights are granted to you.",
      },
    ],
  },
  {
    id: "fees-billing",
    title: "10) Fees and Billing",
    blocks: [
      {
        type: "paragraph",
        text: "Paid features may be introduced over time. Where applicable, pricing, billing terms, and payment obligations will be described in your order flow, plan details, or separate commercial agreement.",
      },
      {
        type: "paragraph",
        text: "Failure to pay applicable fees may result in service limitations, suspension, or termination where permitted.",
      },
    ],
  },
  {
    id: "suspension-termination",
    title: "11) Suspension / Termination",
    blocks: [
      {
        type: "paragraph",
        text: "We may suspend or terminate access if we reasonably determine there is abuse, security risk, nonpayment, unlawful activity, or violation of these Terms.",
      },
      {
        type: "paragraph",
        text: "You may stop using the Service at any time. Additional post-termination obligations may apply as stated in separate agreements.",
      },
    ],
  },
  {
    id: "disclaimers",
    title: "12) Disclaimers",
    blocks: [
      {
        type: "paragraph",
        text: "To the fullest extent permitted by applicable law, the Service is provided on an \"as is\" and \"as available\" basis without warranties of any kind, express or implied.",
      },
      {
        type: "paragraph",
        text: "We do not warrant uninterrupted service, error-free operation, or that outputs will satisfy all customer requirements.",
      },
    ],
  },
  {
    id: "limitation-of-liability",
    title: "13) Limitation of Liability",
    blocks: [
      {
        type: "paragraph",
        text: `To the fullest extent permitted by law, ${legalCompanyName} and its affiliates, officers, employees, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, data, goodwill, or business opportunities.`,
      },
      {
        type: "paragraph",
        text: "Where liability limits are required, our aggregate liability for claims relating to the Service will be limited to amounts paid by the customer for the Service during the twelve-month period before the event giving rise to the claim, unless a different limit applies under a written agreement or applicable law.",
      },
    ],
  },
  {
    id: "indemnity",
    title: "14) Indemnity",
    blocks: [
      {
        type: "paragraph",
        text: `You agree to indemnify and hold harmless ${legalCompanyName} from third-party claims, damages, and reasonable costs (including legal fees) arising from your use of the Service, your customer content, or your violation of these Terms, to the extent permitted by applicable law.`,
      },
    ],
  },
  {
    id: "changes-to-service",
    title: "15) Changes to the Service",
    blocks: [
      {
        type: "paragraph",
        text: "We may change, add, or remove features at any time. We may also modify or discontinue portions of the Service where reasonably necessary for technical, security, legal, or business reasons.",
      },
    ],
  },
  {
    id: "changes-to-terms",
    title: "16) Changes to the Terms",
    blocks: [
      {
        type: "paragraph",
        text: "We may update these Terms from time to time. Material changes may be communicated through the Service or by other appropriate notice. Continued use after updates takes effect constitutes acceptance of the revised Terms where permitted by law.",
      },
    ],
  },
  {
    id: "governing-law",
    title: "17) Governing Law and Venue",
    blocks: [
      {
        type: "paragraph",
        text: governingLawVenueClause,
      },
    ],
  },
  {
    id: "contact",
    title: "18) Contact Information",
    blocks: [
      {
        type: "paragraph",
        text: `For legal questions about these Terms, contact ${legalCompanyName} at ${termsContactEmail}.`,
      },
    ],
  },
];
