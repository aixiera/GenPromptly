/**
 * Public site design note
 *
 * Direction A — Premium Editorial Founder
 * Clean typography, off-white surfaces, restrained accents, and generous spacing.
 *
 * Direction B — Modern Technical Consultant
 * Darker system panels, subtle gradients, and a stronger sense of practical execution.
 *
 * Direction C — Product + Studio Hybrid
 * Clear commercial structure for services, demos, products, and contact while staying refined.
 *
 * Selected direction:
 * Direction C, borrowing the editorial restraint of A and the darker contrast moments of B.
 */

export type SiteNavItem = {
  href: string;
  label: string;
};

export type ServiceOffer = {
  title: string;
  price: string;
  description: string;
  bestFor: string;
  includes: string[];
  deliverable: string;
  ctaLabel: string;
  href: string;
};

export type ShowcaseItem = {
  title: string;
  category: string;
  tag: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  price?: string;
  status?: string;
  href: string;
  ctaLabel: string;
};

export type SocialLink = {
  label: string;
  href: string;
};

export const siteContent = {
  owner: {
    name: "Kairui Bi",
    label: "Founder-led AI systems and digital products",
    title: "Builder, consultant, and product-minded technical operator",
    location: "Surrey, BC, Canada",
    email: "bia446635@gmail.com",
    availability:
      "Currently available for focused consulting, workflow audits, and selected implementation projects.",
    profileImage: "/site/founder-kairui-bi.jpg",
    profileImageAlt: "Portrait of Kairui Bi",
    wechatQrImage: "/site/wechat-qr.jpg",
    bookingUrl: "",
    resumeUrl: "",
  },
  seo: {
    title: "Kairui Bi",
    description:
      "Kairui Bi builds practical AI tools, automation systems, and digital products for real use cases.",
  },
  nav: [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/services", label: "Services" },
    { href: "/demo-gallery", label: "Demo Gallery" },
    { href: "/digital-resources", label: "Digital Resources" },
    { href: "/genpromptly", label: "GenPromptly" },
    { href: "/background", label: "Background" },
    { href: "/contact", label: "Contact" },
  ] satisfies SiteNavItem[],
  socials: [
    { label: "LinkedIn", href: "" },
    { label: "GitHub", href: "" },
    { label: "Instagram", href: "" },
  ] satisfies SocialLink[],
  hero: {
    headline: "Building practical AI tools, automation systems, and digital products for real work",
    subheadline:
      "I’m Kairui Bi. I design and implement practical AI workflows, n8n automations, internal tools, and focused digital resources that are meant to be useful, clear, and ready to ship.",
    primaryCta: { label: "Work with me", href: "/contact" },
    secondaryCta: { label: "Explore demos", href: "/demo-gallery" },
    tertiaryCta: { label: "See GenPromptly", href: "/genpromptly" },
    chips: [
      "AI workflows",
      "n8n automation",
      "Prompt systems",
      "Digital resources",
      "Founder-built tools",
    ],
  },
  whatIDo: [
    {
      title: "AI consulting",
      description:
        "Strategy, use-case clarification, and practical planning for teams or founders exploring where AI can genuinely help.",
    },
    {
      title: "Workflow and agent implementation",
      description:
        "Focused n8n automations, internal assistants, and small operational systems built around a real process.",
    },
    {
      title: "Digital resources",
      description:
        "Templates, checklists, blueprints, and other self-serve materials that make planning easier.",
    },
    {
      title: "GenPromptly",
      description:
        "A prompt polishing tool that helps turn rough instructions into clearer, more structured prompts.",
    },
  ],
  focusAreas: [
    "AI workflow planning",
    "n8n automations",
    "Internal AI assistants",
    "Prompt systems",
    "Operations automation",
    "Lead capture flows",
    "Knowledge tools",
    "Digital toolkits",
    "Founder experiments",
    "Usable micro-products",
  ],
  credibility: [
    {
      title: "Founder-built, not outsourced",
      description:
        "The thinking, design decisions, and implementation are handled directly, which keeps communication clear and tradeoffs visible.",
    },
    {
      title: "Technical and product-minded",
      description:
        "The work is shaped by systems thinking, interface judgment, and a bias toward something that can actually be used after launch.",
    },
    {
      title: "Research-informed background",
      description:
        "My background includes algorithms, computer vision, mathematics, HCI interests, and research publication experience.",
    },
    {
      title: "Grounded early delivery experience",
      description:
        "I’ve worked with early clients on practical workflow and AI-related solutions, and I keep the scope honest rather than oversold.",
    },
  ],
  serviceOffers: [
    {
      title: "Consultation Call",
      price: "CA$79",
      description:
        "A 45 minute strategy and planning session for clarifying an AI use case, workflow direction, or implementation path.",
      bestFor: "Idea clarification, workflow planning, tool stack questions, and realistic next steps.",
      includes: [
        "45 minute live consultation",
        "Pre-call context review",
        "Practical recommendations",
        "Short written recap",
      ],
      deliverable: "A clearer roadmap for what to build, test, or avoid next.",
      ctaLabel: "Book consultation",
      href: "/contact",
    },
    {
      title: "Workflow Audit & Solution Plan",
      price: "CA$199",
      description:
        "An async review plus call for a messy process, automation idea, or AI workflow that needs stronger structure.",
      bestFor: "Founders or small teams who need a concrete solution plan before committing to implementation.",
      includes: [
        "Current process review",
        "Architecture recommendation",
        "Tooling suggestions",
        "Follow-up discussion",
      ],
      deliverable: "A scoped plan with problem breakdown, recommended stack, and next steps.",
      ctaLabel: "Request audit",
      href: "/contact",
    },
    {
      title: "Starter Automation Setup",
      price: "From CA$499",
      description:
        "A focused n8n or AI-assisted workflow build for one contained use case or MVP automation.",
      bestFor: "One clear operational problem that can be improved with a small but meaningful system.",
      includes: [
        "Single use-case implementation",
        "Basic integrations",
        "Prompt or logic configuration",
        "Delivery handoff notes",
      ],
      deliverable: "A working starter automation or internal workflow with clear boundaries.",
      ctaLabel: "Discuss setup",
      href: "/contact",
    },
    {
      title: "Custom AI Agent / n8n Implementation",
      price: "From CA$1,200",
      description:
        "A more custom system for multi-step workflows, internal assistants, lead handling, content processes, or operations support.",
      bestFor: "Broader workflow implementation where multiple steps, logic layers, or integrations are involved.",
      includes: [
        "Implementation planning",
        "Multi-step workflow build",
        "Prompt and logic design",
        "Review and iteration",
      ],
      deliverable: "A tailored system scoped around your use case and delivery constraints.",
      ctaLabel: "Scope a project",
      href: "/contact",
    },
    {
      title: "Ongoing Support / Maintenance",
      price: "From CA$149/month",
      description:
        "Light ongoing support for monitoring, iteration, prompt adjustments, workflow improvements, and practical maintenance.",
      bestFor: "Existing builds that need follow-through, refinement, and low-friction support after launch.",
      includes: [
        "Monitoring and check-ins",
        "Small iterations",
        "Prompt and workflow adjustments",
        "Support communication",
      ],
      deliverable: "Steadier operation and practical refinement over time.",
      ctaLabel: "Ask about support",
      href: "/contact",
    },
  ] satisfies ServiceOffer[],
  productOptions: [
    {
      title: "Digital resources",
      category: "Self-serve",
      tag: "Templates and guides",
      description:
        "A growing library of prompt packs, workflow checklists, blueprints, and practical reference materials.",
      href: "/digital-resources",
      ctaLabel: "Browse resources",
    },
    {
      title: "GenPromptly",
      category: "Product",
      tag: "Prompt polishing tool",
      description:
        "A smaller standalone product that helps clean up rough prompts before they move into a larger workflow.",
      href: "/genpromptly",
      ctaLabel: "See GenPromptly",
    },
  ] satisfies ShowcaseItem[],
  demos: [
    {
      title: "Lead Qualification Workflow Demo",
      category: "n8n workflow demo",
      tag: "Demo",
      description:
        "A practical concept for turning inbound lead information into a clearer qualification path, routed follow-up, and handoff logic.",
      imageSrc: "/site/demo-qualification-agent.png",
      imageAlt: "Lead qualification workflow demo interface",
      href: "/contact",
      ctaLabel: "Request similar system",
    },
    {
      title: "Sales Summary Assistant",
      category: "AI assistant concept",
      tag: "Prototype",
      description:
        "An example of structuring scattered notes into a concise summary for internal review, next actions, and communication handoff.",
      imageSrc: "/site/demo-sales-summary-agent.png",
      imageAlt: "Sales summary assistant example",
      href: "/contact",
      ctaLabel: "Discuss a related workflow",
    },
    {
      title: "Customer Inquiry Triage",
      category: "Internal knowledge tool",
      tag: "Concept",
      description:
        "A lightweight routing and response-drafting concept for recurring customer questions, edge cases, and escalation signals.",
      imageSrc: "/site/demo-customer-agent.png",
      imageAlt: "Customer inquiry triage concept",
      href: "/contact",
      ctaLabel: "Ask about this use case",
    },
    {
      title: "Pre-call Brief Builder",
      category: "Operations automation",
      tag: "Case-style example",
      description:
        "A pre-meeting workflow idea that assembles background context, preparation notes, and useful questions before a call.",
      imageSrc: "/site/demo-precall-cover.jpg",
      imageAlt: "Pre-call brief workflow preview",
      href: "/contact",
      ctaLabel: "Explore a custom version",
    },
    {
      title: "Appointment Record Automation",
      category: "Workflow blueprint",
      tag: "Demo",
      description:
        "An automation-oriented example for capturing appointment data, creating structured records, and keeping follow-up information organized.",
      imageSrc: "/site/demo-appointment-automation.jpg",
      imageAlt: "Appointment record automation cover",
      href: "/contact",
      ctaLabel: "Request a workflow plan",
    },
  ] satisfies ShowcaseItem[],
  resources: [
    {
      title: "AI Workflow Planning Worksheet",
      category: "Templates",
      tag: "Template",
      description:
        "A simple planning sheet for mapping one process, one goal, and the inputs or outputs needed before building.",
      price: "CA$19",
      href: "/contact",
      ctaLabel: "Ask for release details",
    },
    {
      title: "Prompt Review Starter Pack",
      category: "Prompt Packs",
      tag: "Pack",
      description:
        "A small set of review prompts and rewrite patterns for making unclear instructions easier to reuse.",
      price: "CA$29",
      href: "/contact",
      ctaLabel: "Request access",
    },
    {
      title: "n8n Implementation Checklist",
      category: "Guides",
      tag: "Checklist",
      description:
        "A practical reference for scoping integrations, edge cases, failure handling, and delivery handoff before a workflow goes live.",
      price: "CA$12",
      href: "/contact",
      ctaLabel: "Request access",
    },
    {
      title: "Internal AI Assistant Scope Kit",
      category: "Toolkits",
      tag: "Toolkit",
      description:
        "A compact scope-and-logic kit for defining user roles, data boundaries, prompts, and review loops for an internal assistant.",
      price: "CA$24",
      href: "/contact",
      ctaLabel: "Join waitlist",
    },
    {
      title: "Service Intake Automation Blueprint",
      category: "Workflow Blueprints",
      tag: "Blueprint",
      description:
        "A case-style document showing how inquiries, qualification, and follow-up can be turned into a cleaner intake flow.",
      status: "Coming soon",
      href: "/contact",
      ctaLabel: "Ask about availability",
    },
    {
      title: "Small-Team AI Rollout Notes",
      category: "Guides",
      tag: "Guide",
      description:
        "A practical guide for introducing AI into a small team without turning the process into unnecessary complexity.",
      status: "Coming soon",
      href: "/contact",
      ctaLabel: "Request an update",
    },
  ] satisfies ShowcaseItem[],
  genpromptly: {
    summary:
      "GenPromptly is a lightweight prompt polishing tool inside a broader ecosystem of practical AI products and services.",
    description:
      "It helps turn rough prompts into clearer, more structured prompts so they are easier to reuse, review, and plug into a workflow. It does not promise perfect outputs. It helps make inputs better.",
    appHref: "/sign-up",
    pricingHref: "/pricing",
    featurePoints: [
      "Turns vague prompts into clearer instructions",
      "Adds structure for workflow-driven use cases",
      "Useful for founders, operators, creators, and small teams",
    ],
    audiences: [
      "Founders who want cleaner prompts before testing an AI workflow",
      "Operators who need clearer instructions inside a repeatable process",
      "Creators or students working from rough first drafts",
      "Teams who want prompt quality to be easier to review",
    ],
    before:
      "make a better email to convince people to book a demo for my AI service",
    after:
      "Write a concise follow-up email for a founder-led AI consulting service. Audience: a small-business owner who asked about automating intake. Goal: move them toward a 20-minute discovery call. Tone: clear, professional, low-pressure. Include: a short reminder of the problem discussed, one concrete use case, two possible booking windows, and a direct call to action.",
  },
  about: {
    intro:
      "I’m interested in useful systems more than impressive-sounding ones. My work sits between product building, technical implementation, and clear communication.",
    story:
      "My background combines strong academic training, research experience in algorithms and computer vision, community leadership, and a practical interest in how people actually use technology. I care about HCI, mathematics, workflow clarity, and building tools that support real tasks instead of just sounding advanced.",
    values: [
      {
        title: "Practical over performative",
        description:
          "I prefer a system that saves friction in daily work over something that only looks good in a polished demo.",
      },
      {
        title: "Clear thinking over vague AI language",
        description:
          "Projects are easier to trust when the scope, logic, and constraints are all visible from the beginning.",
      },
      {
        title: "Builder mindset",
        description:
          "I like shaping the strategy and the implementation together so the final result still makes sense when it meets reality.",
      },
    ],
    currentFocus: [
      "Founder-led AI consulting for real workflows",
      "n8n automation and small-team operations systems",
      "Prompt tools and workflow-ready digital products",
      "Experiments that connect research thinking with real usability",
    ],
  },
  background: {
    education: [
      "Strong academic background with emphasis on technical rigor, mathematics, and research-based problem solving.",
      "Longstanding interest in algorithms, computer vision, HCI, and practical technology.",
    ],
    leadership: [
      "Director of Tech Support, ISMART Multicultural Youth Association.",
      "Co-founder and Secretary General, Canadian Youth Leadership and Multicultural Service Association.",
    ],
    community: [
      "Community-facing leadership and support experience shaped how I think about usable systems and clear communication.",
      "Interested in technology that creates practical value while staying understandable to real people.",
    ],
    research: [
      "Research experience in algorithms and computer vision.",
      "Published research as first or corresponding author.",
      "Participated in discussions around AI, agentic systems, and bionic eyes.",
    ],
    awards: [
      "Selected awards, publications, and formal resume details can be added here as a downloadable asset when finalized.",
    ],
    interests: [
      "Human-computer interaction",
      "Mathematics",
      "Applied AI systems",
      "Digital product design",
      "Community impact",
    ],
  },
  homeStoryPreview:
    "The site is positioned around Kairui Bi as the operator, builder, and consultant. GenPromptly is part of the ecosystem, but not the full identity.",
  contactFaq: [
    {
      question: "What kinds of projects are a good fit?",
      answer:
        "Focused workflow problems, internal AI assistants, prompt systems, or founder-led automation projects with a clear use case are usually the best fit.",
    },
    {
      question: "Do you work with larger custom scopes?",
      answer:
        "Yes, but more complex work is scoped after an initial consultation or audit so the expectations stay realistic.",
    },
    {
      question: "Can I ask about GenPromptly and consulting together?",
      answer:
        "Yes. GenPromptly can be a standalone tool, or part of a broader prompt and workflow setup.",
    },
    {
      question: "Is there a live booking link yet?",
      answer:
        "A booking URL can be added when ready. For now, the site is set up to route consultation requests through direct email.",
    },
  ],
} as const;

export function getBookingHref() {
  if (siteContent.owner.bookingUrl) {
    return siteContent.owner.bookingUrl;
  }

  return `mailto:${siteContent.owner.email}?subject=${encodeURIComponent("Consultation inquiry")}`;
}

export function getResumeHref() {
  return siteContent.owner.resumeUrl;
}

export function getAvailableSocialLinks() {
  return siteContent.socials.filter((item) => Boolean(item.href));
}
