
import { z } from "zod";

export const SKILL_KEYS = [
  "compliance_review",
  "image_to_prompt",
  "video_script",
  "marketing_variants",
  "email_pack",
  "workflow_spec",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export const SKILL_OPTIMIZATION_PROFILES = [
  "compliance",
  "image",
  "video",
  "marketing",
  "email",
  "workflow",
] as const;

export const LEGACY_OPTIMIZATION_PROFILES = [
  "general",
  "clarity",
  "structure",
  "detail",
  "healthcare",
  "finance",
  "legal",
] as const;

export const OPTIMIZATION_PROFILES = [
  ...SKILL_OPTIMIZATION_PROFILES,
  ...LEGACY_OPTIMIZATION_PROFILES,
] as const;

export type SkillOptimizationProfile = (typeof SKILL_OPTIMIZATION_PROFILES)[number];
export type LegacyOptimizationProfile = (typeof LEGACY_OPTIMIZATION_PROFILES)[number];
export type OptimizationProfile = (typeof OPTIMIZATION_PROFILES)[number];

export const DEFAULT_SKILL_KEY: SkillKey = "workflow_spec";

const optimizationProfileLabels: Record<OptimizationProfile, string> = {
  compliance: "Compliance",
  image: "Image",
  video: "Video",
  marketing: "Marketing",
  email: "Email",
  workflow: "Workflow",
  general: "General",
  clarity: "Clarity",
  structure: "Structure",
  detail: "Detail",
  healthcare: "Healthcare",
  finance: "Finance",
  legal: "Legal",
};

type JsonSchemaNode =
  | string
  | number
  | boolean
  | null
  | JsonSchemaNode[]
  | { [key: string]: JsonSchemaNode };

export type ToolJsonSchema = {
  type: "object";
  additionalProperties: boolean;
  required: string[];
  properties: Record<string, JsonSchemaNode>;
};

export type ToolUiHints = {
  inputLabel: string;
  outputLabel: string;
  emptyState: string;
};

export type SkillDefinition = {
  skillKey: SkillKey;
  routeKey: string;
  legacyRouteKeys: string[];
  displayName: string;
  shortDescription: string;
  longerDescription: string;
  templateKey: SkillKey;
  editorTitle: string;
  editorSubtitle: string;
  workflowPurpose: string;
  defaultInputLabel: string;
  defaultPlaceholder: string;
  helperText: string;
  resultTitle: string;
  allowedOptimizeBehavior: SkillOptimizationProfile[];
  outputSchema: ToolJsonSchema;
  promptHints: string[];
  defaultSections: string[];
  saveLabel: string;
  optimizeLabel: string;
  emptyStateText: string;
  kernelPrompt: string;
  defaultPrompt: string;
  defaultTitle: string;
  goalPlaceholder: string;
  outputHint: string;
  workflowCategory: string;
  defaultVariables: Record<string, string>;
  requiredStructuredDataFields: string[];
};

export type ToolWorkflow = SkillDefinition & {
  key: SkillKey;
  toolKey: SkillKey;
  name: string;
  description: string;
  workflowProfile: SkillOptimizationProfile;
  setupItems: string[];
  promptPlaceholder: string;
  launchLabel: string;
  nextStepHint: string;
  allowedOptimizationProfiles: OptimizationProfile[];
  defaultOptimizationProfile: SkillOptimizationProfile;
  uiHints: ToolUiHints;
  systemPrompt: string;
};

const SCORE_SCHEMA: JsonSchemaNode = {
  type: "object",
  additionalProperties: false,
  required: ["clarity", "context", "constraints", "format"],
  properties: {
    clarity: { type: "number", minimum: 0, maximum: 10 },
    context: { type: "number", minimum: 0, maximum: 10 },
    constraints: { type: "number", minimum: 0, maximum: 10 },
    format: { type: "number", minimum: 0, maximum: 10 },
  },
};

const BASE_RESULT_PROPERTIES: Record<string, JsonSchemaNode> = {
  optimizedPrompt: { type: "string" },
  keyChanges: {
    type: "array",
    items: { type: "string" },
  },
  recommendations: {
    type: "array",
    items: { type: "string" },
  },
  structure: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      sections: {
        type: "array",
        items: { type: "string" },
      },
      constraints: {
        type: "array",
        items: { type: "string" },
      },
      outputFormat: { type: "string" },
    },
  },
  scores: SCORE_SCHEMA,
  missingFields: {
    type: "array",
    items: { type: "string" },
  },
  riskFlags: {
    type: "array",
    items: { type: "string" },
  },
};

const BASE_RESULT_REQUIRED = [
  "optimizedPrompt",
  "keyChanges",
  "recommendations",
  "structure",
  "scores",
  "missingFields",
  "riskFlags",
  "structuredData",
];

function buildSkillOutputSchema(
  structuredDataProperties: Record<string, JsonSchemaNode>,
  structuredDataRequired: string[]
): ToolJsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: BASE_RESULT_REQUIRED,
    properties: {
      ...BASE_RESULT_PROPERTIES,
      structuredData: {
        type: "object",
        additionalProperties: false,
        required: structuredDataRequired,
        properties: structuredDataProperties,
      },
    },
  };
}

type CreateSkillInput = Omit<
  SkillDefinition,
  "skillKey" | "routeKey" | "legacyRouteKeys" | "templateKey" | "resultTitle"
> & {
  skillKey: SkillKey;
  routeKey?: string;
  legacyRouteKeys?: string[];
  resultTitle?: string;
  defaultOptimizationProfile: SkillOptimizationProfile;
  launchLabel: string;
  nextStepHint?: string;
};

function createSkillEntry(input: CreateSkillInput): ToolWorkflow {
  const routeKey = input.routeKey ?? input.skillKey;
  const legacyRouteKeys = input.legacyRouteKeys ?? [input.skillKey.replace(/_/g, "-")];
  const resultTitle = input.resultTitle ?? `${input.displayName} Result`;

  return {
    ...input,
    key: input.skillKey,
    routeKey,
    legacyRouteKeys,
    resultTitle,
    toolKey: input.skillKey,
    name: input.displayName,
    description: input.shortDescription,
    templateKey: input.skillKey,
    workflowProfile: input.defaultOptimizationProfile,
    setupItems: input.promptHints,
    promptPlaceholder: input.defaultPlaceholder,
    allowedOptimizationProfiles: [input.defaultOptimizationProfile],
    defaultOptimizationProfile: input.defaultOptimizationProfile,
    nextStepHint: input.nextStepHint ?? `Template: ${input.skillKey}`,
    uiHints: {
      inputLabel: input.defaultInputLabel,
      outputLabel: resultTitle,
      emptyState: input.emptyStateText,
    },
    systemPrompt: input.kernelPrompt,
  };
}

const skillWorkflows: ToolWorkflow[] = [
  createSkillEntry({
    skillKey: "compliance_review",
    displayName: "Compliance Review",
    shortDescription: "Review content for policy, risk, and compliance-oriented issues.",
    longerDescription:
      "Run a policy-oriented review to surface risk signals, explain why they matter, and produce safer rewrites with clear recommendations.",
    editorTitle: "Compliance Review",
    editorSubtitle: "Review content for policy, risk, and compliance-oriented issues.",
    workflowPurpose: "Identify risk signals, improve compliance clarity, and generate safer prompt rewrites.",
    defaultInputLabel: "Content to Review",
    defaultPlaceholder:
      "Paste the content or prompt to review, then include policy context, risk tolerance, jurisdiction, and review objective.",
    helperText:
      "Use this workflow to detect policy and compliance risk signals, strengthen guardrails, and produce safer alternatives.",
    allowedOptimizeBehavior: ["compliance"],
    outputSchema: buildSkillOutputSchema(
      {
        summary: { type: "string" },
        findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["severity", "category", "issue", "impact", "recommendation"],
            properties: {
              severity: { type: "string", enum: ["low", "medium", "high"] },
              category: { type: "string" },
              issue: { type: "string" },
              impact: { type: "string" },
              recommendation: { type: "string" },
            },
          },
        },
        recommendations: {
          type: "array",
          items: { type: "string" },
        },
        riskSignals: {
          type: "array",
          items: { type: "string" },
        },
        frameworkNotes: {
          type: "array",
          items: { type: "string" },
        },
      },
      ["summary", "findings", "recommendations"]
    ),
    promptHints: [
      "Paste the content to review.",
      "Specify applicable policy or framework.",
      "Set risk tolerance and review objective.",
      "Include jurisdiction or region when relevant.",
    ],
    defaultSections: [
      "Risk Summary",
      "Findings",
      "Safer Rewrite",
      "Recommendations",
      "Framework Notes",
    ],
    saveLabel: "Save Compliance Prompt",
    optimizeLabel: "Run Compliance Review",
    emptyStateText: "Run optimize to generate findings, recommendations, and a safer rewrite.",
    kernelPrompt: [
      "You are a compliance and policy review specialist for B2B SaaS prompt operations.",
      "Optimize for risk detection, policy alignment, operational clarity, and actionable mitigation.",
      "Do not provide legal advice, legal certainty, or unsupported claims.",
      "Return professional, concise findings that map risks to concrete remediation.",
      "Ensure structuredData includes summary, findings, recommendations, riskSignals, and frameworkNotes.",
    ].join(" "),
    defaultPrompt:
      "Review the following content for policy and compliance risk.\n\nContent to review:\n\nApplicable policy/framework:\n-\n\nRisk tolerance:\n\nJurisdiction/region:\n\nReview objective:\n\nReturn:\n1) Risk summary\n2) Findings with severity and impact\n3) Safer rewrite\n4) Recommendations",
    defaultTitle: "Compliance Review Prompt",
    goalPlaceholder: "Optional: prioritize high-confidence findings and stronger remediation guidance.",
    outputHint: "Structured risk findings with safer rewrite recommendations.",
    workflowCategory: "Compliance",
    defaultVariables: {
      policyFramework: "Internal policy + regulatory controls",
      riskTolerance: "Medium",
      jurisdiction: "United States",
      objective: "Identify risky instructions and improve compliance clarity",
    },
    requiredStructuredDataFields: ["summary", "findings", "recommendations"],
    defaultOptimizationProfile: "compliance",
    launchLabel: "Open Compliance Review",
  }),
  createSkillEntry({
    skillKey: "image_to_prompt",
    displayName: "Image To Prompt",
    shortDescription: "Turn a visual concept into a stronger image-generation prompt.",
    longerDescription:
      "Convert visual intent into reusable image prompts with style, composition, lighting, framing, and optional negative prompt suggestions.",
    editorTitle: "Image To Prompt",
    editorSubtitle: "Turn a visual concept into a stronger image-generation prompt.",
    workflowPurpose: "Produce reusable image prompts with vivid visual guidance and clear generation constraints.",
    defaultInputLabel: "Visual Concept",
    defaultPlaceholder:
      "Describe subject, style, composition, lighting, camera/framing, platform/model, and intended use.",
    helperText:
      "Use this workflow to transform rough visual ideas into production-ready prompts for image generation tools.",
    allowedOptimizeBehavior: ["image"],
    outputSchema: buildSkillOutputSchema(
      {
        styleNotes: {
          type: "array",
          items: { type: "string" },
        },
        compositionNotes: {
          type: "array",
          items: { type: "string" },
        },
        additionsMade: {
          type: "array",
          items: { type: "string" },
        },
        negativePromptSuggestions: {
          type: "array",
          items: { type: "string" },
        },
        platformNotes: { type: "string" },
      },
      ["styleNotes", "compositionNotes", "additionsMade"]
    ),
    promptHints: [
      "Define subject and visual intent.",
      "Set style direction and realism.",
      "Specify composition, camera/framing, and lighting.",
      "Include platform/model constraints and intended use.",
    ],
    defaultSections: [
      "Final Image Prompt",
      "Style Notes",
      "Composition Notes",
      "Additions Made",
      "Negative Prompt Suggestions",
    ],
    saveLabel: "Save Image Prompt",
    optimizeLabel: "Optimize Image Prompt",
    emptyStateText: "Run optimize to generate a reusable image prompt with visual improvements.",
    kernelPrompt: [
      "You are an image prompt engineer for professional creative workflows.",
      "Optimize for visual specificity, composition quality, style coherence, and generation reliability.",
      "Do not return vague adjectives without concrete visual detail.",
      "Return structuredData with styleNotes, compositionNotes, additionsMade, optional negativePromptSuggestions, and platformNotes.",
      "Keep output practical for direct use in image-generation platforms.",
    ].join(" "),
    defaultPrompt:
      "Turn this visual concept into a reusable image-generation prompt.\n\nSubject:\nStyle:\nComposition:\nLighting:\nCamera/framing:\nPlatform/model:\nIntended use:\n\nReturn a polished final prompt plus improvement notes.",
    defaultTitle: "Image To Prompt Workflow",
    goalPlaceholder: "Optional: prioritize stronger composition control and style consistency.",
    outputHint: "Reusable image prompt with style and composition upgrades.",
    workflowCategory: "Creative",
    defaultVariables: {
      style: "Cinematic realism",
      composition: "Foreground subject, balanced depth",
      lighting: "Soft directional lighting",
      platform: "Preferred image model",
    },
    requiredStructuredDataFields: ["styleNotes", "compositionNotes", "additionsMade"],
    defaultOptimizationProfile: "image",
    launchLabel: "Start Image Prompt Workflow",
  }),
  createSkillEntry({
    skillKey: "video_script",
    displayName: "Video Script",
    shortDescription: "Turn a rough idea into a stronger video script or generation prompt.",
    longerDescription:
      "Build structured video prompts with hook, pacing, outline, and CTA-ready flow for narration or generation workflows.",
    editorTitle: "Video Script",
    editorSubtitle: "Turn a rough idea into a stronger video script or video-generation prompt.",
    workflowPurpose: "Convert rough concepts into audience-ready, structured video prompt workflows.",
    defaultInputLabel: "Video Goal and Context",
    defaultPlaceholder:
      "Describe audience, platform, tone, duration, narrative goal, hook, CTA, and key constraints.",
    helperText:
      "Use this workflow to improve pacing, structure, and engagement in video scripts or generation prompts.",
    allowedOptimizeBehavior: ["video"],
    outputSchema: buildSkillOutputSchema(
      {
        hook: { type: "string" },
        structureOutline: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["segment", "purpose", "timing"],
            properties: {
              segment: { type: "string" },
              purpose: { type: "string" },
              timing: { type: "string" },
            },
          },
        },
        ctaNotes: { type: "string" },
        pacingNotes: {
          type: "array",
          items: { type: "string" },
        },
      },
      ["hook", "structureOutline", "ctaNotes"]
    ),
    promptHints: [
      "Define audience and platform context.",
      "Set tone, duration, and narrative goal.",
      "Provide hook direction and CTA intent.",
      "List constraints and must-include details.",
    ],
    defaultSections: [
      "Hook",
      "Structure Outline",
      "Optimized Video Prompt",
      "CTA Notes",
      "Pacing Improvements",
    ],
    saveLabel: "Save Video Script Prompt",
    optimizeLabel: "Optimize Video Script",
    emptyStateText: "Run optimize to generate hook, structure, and pacing-focused video output.",
    kernelPrompt: [
      "You are a video scripting strategist for B2B growth and education content.",
      "Optimize for hook strength, narrative flow, pacing, clarity, and actionable CTA placement.",
      "Do not produce generic scripts without audience/platform adaptation.",
      "Return structuredData with hook, structureOutline, ctaNotes, and pacingNotes.",
      "Keep outputs practical for production and generation workflows.",
    ].join(" "),
    defaultPrompt:
      "Turn this idea into a strong video script prompt.\n\nAudience:\nPlatform:\nTone:\nDuration:\nNarrative goal:\nHook direction:\nCTA:\nConstraints:\n\nReturn a structured outline and optimized prompt.",
    defaultTitle: "Video Script Workflow",
    goalPlaceholder: "Optional: prioritize stronger hook and tighter pacing.",
    outputHint: "Hook + structure outline + CTA-ready script prompt.",
    workflowCategory: "Creative",
    defaultVariables: {
      audience: "B2B operators",
      platform: "YouTube Shorts",
      duration: "60 seconds",
      cta: "Drive qualified response",
    },
    requiredStructuredDataFields: ["hook", "structureOutline", "ctaNotes"],
    defaultOptimizationProfile: "video",
    launchLabel: "Open Video Script Workflow",
  }),
  createSkillEntry({
    skillKey: "marketing_variants",
    displayName: "Marketing Variants",
    shortDescription: "Generate multiple stronger prompt variants for campaign messaging.",
    longerDescription:
      "Create differentiated marketing prompt variants by angle so teams can compare campaign directions quickly.",
    editorTitle: "Marketing Variants",
    editorSubtitle: "Generate multiple stronger prompt variants for campaign messaging.",
    workflowPurpose: "Produce multiple campaign-ready prompt variants with clear angle differentiation.",
    defaultInputLabel: "Campaign Inputs",
    defaultPlaceholder:
      "Provide audience, channel, offer, tone, objective, brand constraints, and key proof points.",
    helperText:
      "Use this workflow to generate multiple high-quality marketing prompt variants and compare angles.",
    allowedOptimizeBehavior: ["marketing"],
    outputSchema: buildSkillOutputSchema(
      {
        baseImprovedPrompt: { type: "string" },
        variants: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["angle", "optimizedPrompt", "notes"],
            properties: {
              angle: { type: "string" },
              optimizedPrompt: { type: "string" },
              notes: { type: "string" },
              bestUseCase: { type: "string" },
            },
          },
        },
        recommendations: {
          type: "array",
          items: { type: "string" },
        },
      },
      ["baseImprovedPrompt", "variants"]
    ),
    promptHints: [
      "Define audience and campaign objective.",
      "Specify channel, offer, and key benefit.",
      "Set tone and brand constraints.",
      "Include CTA and proof points.",
    ],
    defaultSections: [
      "Primary Improved Prompt",
      "Variant Angles",
      "Recommendations",
      "Best-Use Notes",
    ],
    saveLabel: "Save Marketing Prompt",
    optimizeLabel: "Generate Marketing Variants",
    emptyStateText: "Run optimize to generate multiple differentiated marketing variants.",
    kernelPrompt: [
      "You are a marketing prompt strategist focused on campaign experimentation.",
      "Optimize for angle diversity, audience relevance, channel fit, and brand-safe persuasion.",
      "Do not return near-duplicate variants or unsupported claims.",
      "Return structuredData with baseImprovedPrompt, variants (angle, optimizedPrompt, notes), and recommendations.",
      "Ensure each variant has a distinct angle and practical usage context.",
    ].join(" "),
    defaultPrompt:
      "Generate stronger marketing prompt variants for this campaign.\n\nAudience:\nChannel:\nOffer:\nObjective:\nTone:\nBrand constraints:\nCTA:\n\nReturn one improved base prompt and several differentiated variants.",
    defaultTitle: "Marketing Variants Workflow",
    goalPlaceholder: "Optional: prioritize stronger angle separation for A/B testing.",
    outputHint: "Base prompt plus multiple campaign-angle variants.",
    workflowCategory: "Marketing",
    defaultVariables: {
      audience: "B2B operations leaders",
      channel: "LinkedIn + email",
      objective: "Drive demo bookings",
      tone: "Direct and credible",
    },
    requiredStructuredDataFields: ["baseImprovedPrompt", "variants"],
    defaultOptimizationProfile: "marketing",
    launchLabel: "Generate Marketing Variants",
  }),
  createSkillEntry({
    skillKey: "email_pack",
    displayName: "Email Pack",
    shortDescription: "Create stronger prompt structures for outreach and email tasks.",
    longerDescription:
      "Design email-focused prompt structures with subject guidance, body structure, tone control, and CTA direction.",
    editorTitle: "Email Pack",
    editorSubtitle: "Create stronger prompt structures for outreach and email-related tasks.",
    workflowPurpose: "Produce reliable email-generation prompt packages for outreach and internal communication.",
    defaultInputLabel: "Email Context",
    defaultPlaceholder:
      "Describe email objective, audience/recipient type, tone, CTA, constraints, and company context.",
    helperText:
      "Use this workflow to build reusable prompt structures for high-quality email drafting.",
    allowedOptimizeBehavior: ["email"],
    outputSchema: buildSkillOutputSchema(
      {
        subjectLineHints: {
          type: "array",
          items: { type: "string" },
        },
        structureSuggestions: {
          type: "array",
          items: { type: "string" },
        },
        toneGuidance: {
          type: "array",
          items: { type: "string" },
        },
        ctaGuidance: { type: "string" },
      },
      ["subjectLineHints", "structureSuggestions", "ctaGuidance"]
    ),
    promptHints: [
      "Define objective and recipient type.",
      "Set tone and communication constraints.",
      "Specify CTA and required context.",
      "Include must-say and avoid language if applicable.",
    ],
    defaultSections: [
      "Improved Email Prompt",
      "Subject Line Hints",
      "Structure Suggestions",
      "CTA Guidance",
    ],
    saveLabel: "Save Email Prompt",
    optimizeLabel: "Optimize Email Workflow",
    emptyStateText: "Run optimize to generate subject hints, structure guidance, and CTA improvements.",
    kernelPrompt: [
      "You are an email workflow prompt specialist for professional business communication.",
      "Optimize for clarity, recipient fit, tone consistency, and actionable CTA design.",
      "Do not produce spammy, over-promising, or unsupported claims.",
      "Return structuredData with subjectLineHints, structureSuggestions, toneGuidance, and ctaGuidance.",
      "Keep output practical for repeatable outreach workflows.",
    ].join(" "),
    defaultPrompt:
      "Create a stronger email-generation prompt structure.\n\nEmail objective:\nAudience/recipient type:\nTone:\nCTA:\nConstraints:\nCompany/product context:\n\nReturn optimized prompt plus subject/body guidance.",
    defaultTitle: "Email Pack Workflow",
    goalPlaceholder: "Optional: prioritize concise copy and stronger CTA response rates.",
    outputHint: "Email prompt with subject-line and structure guidance.",
    workflowCategory: "Business Communication",
    defaultVariables: {
      objective: "Book discovery calls",
      recipientType: "Operations leaders",
      tone: "Professional and concise",
      cta: "Reply with a preferred time",
    },
    requiredStructuredDataFields: ["subjectLineHints", "structureSuggestions", "ctaGuidance"],
    defaultOptimizationProfile: "email",
    launchLabel: "Open Email Workflow",
  }),
  createSkillEntry({
    skillKey: "workflow_spec",
    displayName: "Workflow Spec",
    shortDescription: "Turn a goal into a structured workflow specification prompt.",
    longerDescription:
      "Transform raw business goals into workflow-ready prompts with explicit inputs, outputs, constraints, and success criteria.",
    editorTitle: "Workflow Spec",
    editorSubtitle: "Turn a goal into a structured workflow specification prompt.",
    workflowPurpose: "Translate goals into implementation-ready AI workflow prompts.",
    defaultInputLabel: "Workflow Requirements",
    defaultPlaceholder:
      "Describe objective, system context, required inputs, expected outputs, constraints, and success criteria.",
    helperText:
      "Use this workflow to define clear workflow prompts that teams can operationalize quickly.",
    allowedOptimizeBehavior: ["workflow"],
    outputSchema: buildSkillOutputSchema(
      {
        workflowStructure: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["step", "purpose"],
            properties: {
              step: { type: "string" },
              purpose: { type: "string" },
              owner: { type: "string" },
            },
          },
        },
        requiredInputs: {
          type: "array",
          items: { type: "string" },
        },
        expectedOutputs: {
          type: "array",
          items: { type: "string" },
        },
        constraintsAdded: {
          type: "array",
          items: { type: "string" },
        },
        nextStepSuggestions: {
          type: "array",
          items: { type: "string" },
        },
      },
      ["workflowStructure", "requiredInputs", "expectedOutputs"]
    ),
    promptHints: [
      "State objective and business context.",
      "Define required inputs and expected outputs.",
      "List constraints and non-negotiables.",
      "Provide success criteria and validation expectations.",
    ],
    defaultSections: [
      "Workflow Prompt",
      "Workflow Structure",
      "Required Inputs",
      "Expected Outputs",
      "Constraints Added",
    ],
    saveLabel: "Save Workflow Spec",
    optimizeLabel: "Build Workflow Spec",
    emptyStateText: "Run optimize to generate a structured workflow specification.",
    kernelPrompt: [
      "You are an AI workflow architect for B2B operations.",
      "Optimize for implementation clarity, deterministic steps, input/output precision, and constraint coverage.",
      "Do not return casual prose without explicit workflow structure.",
      "Return structuredData with workflowStructure, requiredInputs, expectedOutputs, constraintsAdded, and nextStepSuggestions.",
      "Ensure output is practical for direct execution planning.",
    ].join(" "),
    defaultPrompt:
      "Turn this goal into a structured workflow specification prompt.\n\nObjective:\nSystem context:\nInputs:\nOutputs:\nConstraints:\nSuccess criteria:\n\nReturn implementation-ready workflow prompt guidance.",
    defaultTitle: "Workflow Spec Prompt",
    goalPlaceholder: "Optional: prioritize implementation readiness and validation clarity.",
    outputHint: "Structured workflow prompt with inputs/outputs/constraints.",
    workflowCategory: "Operations",
    defaultVariables: {
      objective: "Automate triage and escalation flow",
      inputs: "Structured request payload",
      outputs: "Validated decision and audit trail",
      successCriteria: "High routing accuracy with explicit fallback",
    },
    requiredStructuredDataFields: ["workflowStructure", "requiredInputs", "expectedOutputs"],
    defaultOptimizationProfile: "workflow",
    launchLabel: "Build Workflow Spec",
  }),
];

const skillByKey = new Map(skillWorkflows.map((entry) => [entry.skillKey, entry]));
const skillByTemplateKey = new Map(skillWorkflows.map((entry) => [entry.templateKey, entry]));
const skillByProfile = new Map(skillWorkflows.map((entry) => [entry.workflowProfile, entry]));
const skillByRoute = new Map<string, ToolWorkflow>();

for (const skill of skillWorkflows) {
  skillByRoute.set(skill.routeKey, skill);
  for (const alias of skill.legacyRouteKeys) {
    skillByRoute.set(alias, skill);
  }
}

const legacyModeSkillMap: Record<LegacyOptimizationProfile, SkillKey> = {
  general: "workflow_spec",
  clarity: "workflow_spec",
  structure: "workflow_spec",
  detail: "workflow_spec",
  healthcare: "compliance_review",
  finance: "compliance_review",
  legal: "compliance_review",
};

export function listSkillDefinitions(): ToolWorkflow[] {
  return skillWorkflows;
}

export function listSkillKeys(): SkillKey[] {
  return [...SKILL_KEYS];
}

export function isSkillKey(value: string): value is SkillKey {
  return (SKILL_KEYS as readonly string[]).includes(value);
}

export function getSkillDefinition(skillKey: string | null | undefined): ToolWorkflow | null {
  if (!skillKey) {
    return null;
  }
  if (!isSkillKey(skillKey)) {
    return null;
  }
  return skillByKey.get(skillKey) ?? null;
}

export function getSkillByRouteKey(routeKey: string | null | undefined): ToolWorkflow | null {
  if (!routeKey) {
    return null;
  }
  const trimmed = routeKey.trim();
  if (!trimmed) {
    return null;
  }
  return skillByRoute.get(trimmed) ?? null;
}

export function getSkillByTemplateKey(templateKey: string | null | undefined): ToolWorkflow | null {
  if (!templateKey) {
    return null;
  }
  if (!isSkillKey(templateKey)) {
    return null;
  }
  return skillByTemplateKey.get(templateKey) ?? null;
}

export function getSkillByProfile(profile: string | null | undefined): ToolWorkflow | null {
  if (!profile) {
    return null;
  }
  if (isSkillOptimizationProfile(profile)) {
    return skillByProfile.get(profile) ?? null;
  }
  if (isLegacyOptimizationProfile(profile)) {
    return getSkillDefinition(legacyModeSkillMap[profile]);
  }
  return null;
}

export function mapLegacyModeToSkillKey(mode: string | null | undefined): SkillKey | null {
  if (!mode) {
    return null;
  }
  if (!isLegacyOptimizationProfile(mode)) {
    return null;
  }
  return legacyModeSkillMap[mode];
}

export function resolveSkillDefinition(input: {
  skillKey?: string | null;
  routeKey?: string | null;
  templateKey?: string | null;
  profile?: string | null;
  toolKey?: string | null;
}): ToolWorkflow | null {
  return (
    getSkillDefinition(input.skillKey) ??
    getSkillByRouteKey(input.routeKey) ??
    getSkillByRouteKey(input.toolKey) ??
    getSkillByTemplateKey(input.templateKey) ??
    getSkillByProfile(input.profile) ??
    null
  );
}

export function isOptimizationProfile(profile: string): profile is OptimizationProfile {
  return (OPTIMIZATION_PROFILES as readonly string[]).includes(profile);
}

export function isLegacyOptimizationProfile(profile: string): profile is LegacyOptimizationProfile {
  return (LEGACY_OPTIMIZATION_PROFILES as readonly string[]).includes(profile);
}

export function isSkillOptimizationProfile(profile: string): profile is SkillOptimizationProfile {
  return (SKILL_OPTIMIZATION_PROFILES as readonly string[]).includes(profile);
}

export function getOptimizationProfileLabel(profile: string): string {
  if (isOptimizationProfile(profile)) {
    return optimizationProfileLabels[profile];
  }
  return profile;
}

export const SkillKeySchema = z.enum(SKILL_KEYS);
export const SkillOptimizationProfileSchema = z.enum(SKILL_OPTIMIZATION_PROFILES);

// Backward-compatible tool registry exports.
export const WORKFLOW_OPTIMIZATION_PROFILES = SKILL_OPTIMIZATION_PROFILES;

export function listToolWorkflows(): ToolWorkflow[] {
  return listSkillDefinitions();
}

export function getToolWorkflow(toolKey: string | null | undefined): ToolWorkflow | null {
  return resolveSkillDefinition({
    skillKey: toolKey,
    routeKey: toolKey,
    toolKey,
  });
}

export function getToolWorkflowByTemplateKey(templateKey: string | null | undefined): ToolWorkflow | null {
  return getSkillByTemplateKey(templateKey);
}

export function getToolWorkflowByProfile(profile: string | null | undefined): ToolWorkflow | null {
  return getSkillByProfile(profile);
}

export function resolveToolWorkflow(input: {
  toolKey?: string | null;
  templateKey?: string | null;
  profile?: string | null;
  skillKey?: string | null;
}): ToolWorkflow | null {
  return resolveSkillDefinition({
    toolKey: input.toolKey,
    templateKey: input.templateKey,
    profile: input.profile,
    skillKey: input.skillKey,
  });
}
