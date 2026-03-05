import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

type TemplateDefinition = {
  name: string;
  category: string;
  description: string;
  inputSchema: Prisma.InputJsonObject;
  systemPrompt: string;
};

const templatesByKey: Record<string, TemplateDefinition> = {
  workflow_spec: {
    name: "Workflow Spec",
    description: "Turn a goal into a structured workflow specification.",
    category: "workflow",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["goal", "outputFormat"],
      properties: {
        goal: {
          type: "string",
          title: "Goal",
          description: "Primary objective to achieve.",
          minLength: 3,
          maxLength: 240,
        },
        context: {
          type: "string",
          title: "Context",
          description: "Background, domain context, and stakeholders.",
          maxLength: 6000,
        },
        constraints: {
          type: "string",
          title: "Constraints",
          description: "Hard requirements, limitations, and non-negotiables.",
          maxLength: 6000,
        },
        outputFormat: {
          type: "string",
          title: "Output Format",
          description: "Preferred output structure for the generated workflow.",
          enum: ["JSON", "Markdown", "Table"],
        },
        variables: {
          type: "array",
          title: "Variables",
          description: "Reusable variables expected in the workflow prompt.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: {
              name: {
                type: "string",
                title: "Variable Name",
                minLength: 1,
                maxLength: 80,
              },
              description: {
                type: "string",
                title: "Variable Description",
                maxLength: 600,
              },
              example: {
                type: "string",
                title: "Variable Example",
                maxLength: 600,
              },
            },
          },
        },
        examples: {
          type: "array",
          title: "Examples",
          description: "Reference examples of expected inputs and outputs.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["input", "output"],
            properties: {
              input: {
                type: "string",
                title: "Example Input",
                maxLength: 5000,
              },
              output: {
                type: "string",
                title: "Example Output",
                maxLength: 5000,
              },
            },
          },
        },
        strictness: {
          type: "string",
          title: "Strictness",
          description: "How strictly to enforce constraints and formatting.",
          enum: ["balanced", "strict"],
          default: "balanced",
        },
      },
    },
    systemPrompt: `You are a principal prompt engineer creating implementation-ready workflow prompts.

You must return exactly one JSON object matching this OptimizeResult shape:
{
  "optimizedPrompt": string,
  "keyChanges": string[],
  "scores": {
    "clarity": number,
    "context": number,
    "constraints": number,
    "format": number
  },
  "missingFields": string[],
  "riskFlags": string[]
}

Return JSON only.
Do not return markdown, code fences, prose outside JSON, or additional keys.

Input fields:
- goal (required short text)
- context (optional long text)
- constraints (optional long text)
- outputFormat (required: JSON | Markdown | Table)
- variables (optional list of { name, description, example })
- examples (optional list of { input, output })
- strictness (balanced | strict; default balanced)

Construct optimizedPrompt as plain text with these sections in this exact order:
1) Purpose
2) Variables
3) Step-by-step Instructions
4) Output JSON Schema
5) Validation Rules
6) Failure Handling / Retry Policy
7) Test Cases

Section requirements:
- Purpose: one concise paragraph tied to goal and outputFormat.
- Variables: include each variable with name, type, required, default, description, example.
  If variables are missing, infer a minimal safe set and state defaults.
- Step-by-step Instructions: numbered, deterministic steps the downstream AI should execute.
- Output JSON Schema: explicit keys and primitive/array/object types; align to outputFormat.
- Validation Rules: input checks, constraint checks, and rejection criteria.
- Failure Handling / Retry Policy: error classes, retry limits, and fallback behavior.
- Test Cases: exactly 3 cases (happy path, edge case, failure case) with expected outcomes.

OptimizeResult field rules:
- keyChanges must be specific and non-generic, referencing concrete improvements made.
- missingFields must be actionable requests, phrased as clear next inputs the user should provide.
- riskFlags must use only these labels: ["PII", "PolicyRisk", "AmbiguousSpec", "MissingConstraints"].
- Evaluate all four risk categories each time; include every applicable label, otherwise use [].
- scores must be numeric from 0 to 10.

Quality rules:
- Preserve user intent.
- Do not invent unsupported domain facts.
- If strictness is "strict", enforce tighter constraints, stricter validation, and narrower outputs.
- If strictness is "balanced", keep structure rigorous while allowing practical defaults.`,
  },
  email_pack: {
    name: "Email Pack",
    description: "Generate an email set with subject lines and body variants.",
    category: "email",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["senderRole", "recipientRole", "purpose"],
      properties: {
        senderRole: {
          type: "string",
          title: "Sender Role",
          minLength: 1,
          maxLength: 120,
        },
        recipientRole: {
          type: "string",
          title: "Recipient Role",
          minLength: 1,
          maxLength: 120,
        },
        purpose: {
          type: "string",
          title: "Purpose",
          minLength: 3,
          maxLength: 500,
        },
        keyDetails: {
          type: "array",
          title: "Key Details",
          description: "Optional bullet points to include in the email.",
          items: {
            type: "string",
            minLength: 1,
            maxLength: 500,
          },
        },
        tone: {
          type: "string",
          title: "Tone",
          enum: ["formal", "neutral", "friendly"],
          default: "neutral",
        },
        length: {
          type: "string",
          title: "Length",
          enum: ["short", "medium", "long"],
          default: "medium",
        },
        callToAction: {
          type: "string",
          title: "Call To Action",
          maxLength: 500,
        },
        constraints: {
          type: "object",
          title: "Constraints",
          description: "Optional guidance on what to include or avoid.",
          additionalProperties: false,
          properties: {
            doSay: {
              type: "array",
              title: "Do Say",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 500,
              },
            },
            dontSay: {
              type: "array",
              title: "Don't Say",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 500,
              },
            },
          },
        },
      },
    },
    systemPrompt: `You are a senior email optimization specialist.

You must return exactly one OptimizeResult JSON object with:
- optimizedPrompt (string)
- keyChanges (string[])
- scores (object with clarity/context/constraints/format numeric 0-10)
- missingFields (string[])
- riskFlags (string[])

Return JSON only. Do not return markdown fences or extra keys.

Input fields:
- senderRole (required)
- recipientRole (required)
- purpose (required)
- keyDetails (optional bullet list)
- tone (formal | neutral | friendly)
- length (short | medium | long)
- callToAction (optional)
- constraints.doSay (optional list)
- constraints.dontSay (optional list)

optimizedPrompt requirements:
- Produce exactly 3 email variants: Formal, Neutral, Friendly.
- Each variant must include:
  - Subject
  - Body
  - CTA line (explicit, clear, and actionable)
- Body length must follow the length input (short/medium/long).
- Use senderRole, recipientRole, purpose, keyDetails, and constraints.
- Respect constraints.dontSay strictly.
- Avoid over-promising, guarantees, or unsupported claims.

Safety and risk rules:
- If medical, legal, or financial claims appear (or are implied), add risk flags.
- Use concise labels such as: "MedicalClaim", "LegalClaim", "FinancialClaim", "OverPromising", "PolicyRisk".
- If no risk applies, use [].

Quality rules:
- keyChanges must explain concrete improvements to structure, clarity, tone control, and CTA quality.
- missingFields must be actionable requests for missing context needed to improve quality.
- scores must reflect:
  - clarity: readability and directness
  - context: correct use of roles and purpose
  - constraints: compliance with do/dont guidance and safety limits
  - format: correct 3-variant structure with Subject/Body/CTA in each
- Preserve user intent and keep language professional.`,
  },
  marketing_variants: {
    name: "Marketing Variants",
    description: "Create short marketing copy variants for different channels.",
    category: "marketing",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["productName", "targetAudience", "keyBenefit"],
      properties: {
        productName: {
          type: "string",
          title: "Product Name",
          minLength: 1,
          maxLength: 180,
        },
        targetAudience: {
          type: "string",
          title: "Target Audience",
          minLength: 1,
          maxLength: 300,
        },
        keyBenefit: {
          type: "string",
          title: "Key Benefit",
          minLength: 3,
          maxLength: 400,
        },
        proof: {
          type: "string",
          title: "Proof",
          description: "Optional evidence, metric, testimonial, or proof point.",
          maxLength: 800,
        },
        platform: {
          type: "string",
          title: "Platform",
          enum: ["X", "Instagram", "LinkedIn", "Website"],
          default: "Website",
        },
        voice: {
          type: "string",
          title: "Voice",
          enum: ["bold", "friendly", "premium", "technical"],
          default: "friendly",
        },
        cta: {
          type: "string",
          title: "CTA",
          maxLength: 300,
        },
      },
    },
    systemPrompt: `You are a senior performance marketing strategist.

You must return exactly one OptimizeResult JSON object with:
- optimizedPrompt (string)
- keyChanges (string[])
- scores (object with clarity/context/constraints/format numeric 0-10)
- missingFields (string[])
- riskFlags (string[])

Return JSON only. Do not return markdown fences or additional top-level keys.

Input fields:
- productName (required)
- targetAudience (required)
- keyBenefit (required)
- proof (optional)
- platform (X | Instagram | LinkedIn | Website)
- voice (bold | friendly | premium | technical)
- cta (optional)

optimizedPrompt requirements:
- Produce exactly 5 variants using these angles in order:
  1) Problem-first
  2) Benefit-first
  3) Story
  4) Proof
  5) Urgency
- Each variant must include these labeled lines:
  - Hook:
  - Benefit:
  - Proof:
  - CTA:
  - A/B note:
- "A/B note" must be short (one sentence) and suggest one concrete test.
- Adapt copy to platform and selected voice.
- If cta is missing, infer one clear and safe CTA.
- Do not fabricate statistics, testimonials, certifications, or guarantees.

Risk policy:
- Add risk flags when copy includes forbidden claims or sensitive categories.
- Forbidden claims include guaranteed outcomes, unrealistic promises, or unverified medical/legal/financial assertions.
- Sensitive categories include medical, legal, financial, gambling, and claims involving minors.
- Use concise labels such as: "ForbiddenClaim", "SensitiveCategory", "PolicyRisk", "UnverifiedProof", "OverPromising".
- If no risk applies, use [].

Quality rules:
- keyChanges must explain concrete improvements in angle differentiation, clarity, platform fit, proof handling, and CTA strength.
- missingFields must be actionable requests for absent inputs (for example missing proof source or audience segment).
- scores must reflect:
  - clarity: message readability and sharpness
  - context: fit to productName, targetAudience, platform, voice
  - constraints: compliance with safety and claim limits
  - format: exactly 5 angle variants each with Hook/Benefit/Proof/CTA/A/B note
- Preserve user intent and keep claims defensible.`,
  },
  video_script: {
    name: "Video Script",
    description: "Draft a short video script with hook, body, and CTA.",
    category: "video",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["videoGoal", "audience", "durationSeconds"],
      properties: {
        videoGoal: {
          type: "string",
          title: "Video Goal",
          minLength: 3,
          maxLength: 400,
        },
        audience: {
          type: "string",
          title: "Audience",
          minLength: 1,
          maxLength: 240,
        },
        durationSeconds: {
          type: "number",
          title: "Duration (Seconds)",
          minimum: 5,
          maximum: 1200,
        },
        style: {
          type: "string",
          title: "Style",
          enum: ["cinematic", "documentary", "UGC", "animation"],
          default: "UGC",
        },
        setting: {
          type: "string",
          title: "Setting",
          maxLength: 400,
        },
        mustInclude: {
          type: "array",
          title: "Must Include",
          items: {
            type: "string",
            minLength: 1,
            maxLength: 500,
          },
        },
        avoid: {
          type: "array",
          title: "Avoid",
          items: {
            type: "string",
            minLength: 1,
            maxLength: 500,
          },
        },
      },
    },
    systemPrompt: `You are a senior video script director and storyboard planner.

You must return exactly one OptimizeResult JSON object with:
- optimizedPrompt (string)
- keyChanges (string[])
- scores (object with clarity/context/constraints/format numeric 0-10)
- missingFields (string[])
- riskFlags (string[])

Return JSON only. Do not return markdown fences or extra top-level keys.

Input fields:
- videoGoal (required)
- audience (required)
- durationSeconds (required number)
- style (cinematic | documentary | UGC | animation)
- setting (optional)
- mustInclude (optional bullet list)
- avoid (optional bullet list)

optimizedPrompt requirements:
- Build a production-ready script package with these sections in order:
  1) Timeline
  2) Shot List
  3) VO Script
  4) On-Screen Text
  5) Visual Prompts

Timeline section rules:
- Use timestamp ranges like "0:00-0:10", "0:10-0:20".
- Cover the full durationSeconds without gaps.
- Each timeline line must state intent and scene action.

Shot List section rules:
- Include one line per shot with:
  - shot#
  - camera
  - motion
  - lighting
  - composition
  - setting
- Ensure shot list order matches the timeline.

VO Script section rules:
- Provide voice-over lines aligned to timeline timestamps.
- Tone and pacing must fit audience and style.

On-Screen Text section rules:
- Provide concise text overlays aligned to timeline.
- Keep overlays readable and non-redundant with VO.

Visual Prompts section rules:
- Include one "visual prompt" line per shot, usable for video/image generation.
- Each line should include subject, action, style, lens/composition cues, lighting, and setting.

Constraint rules:
- Respect mustInclude items explicitly.
- Exclude anything listed in avoid.
- If setting is missing, infer a neutral default and mention it.

Quality rules:
- keyChanges must describe concrete upgrades to pacing, shot clarity, narrative flow, and production detail.
- missingFields must be actionable requests for production-critical gaps (brand assets, legal disclaimers, casting, location limits).
- scores must reflect:
  - clarity: script readability and execution precision
  - context: alignment to videoGoal, audience, style, and setting
  - constraints: compliance with mustInclude/avoid
  - format: presence and alignment of all required sections`,
  },
  image_to_prompt: {
    name: "Image To Prompt",
    description: "Convert visual intent into a reusable image-generation prompt.",
    category: "image",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      anyOf: [{ required: ["imageUrl"] }, { required: ["imageUploadInstructions"] }],
      properties: {
        imageUrl: {
          type: "string",
          title: "Image URL",
          format: "uri",
          maxLength: 2000,
          description: "Publicly accessible source image URL.",
        },
        imageUploadInstructions: {
          type: "string",
          title: "Image Upload Instructions",
          maxLength: 1200,
          description: "If upload is supported, provide instructions for how to upload the source image.",
        },
        goalStyle: {
          type: "string",
          title: "Goal Style",
          maxLength: 500,
        },
        aspectRatio: {
          type: "string",
          title: "Aspect Ratio",
          enum: ["1:1", "16:9", "9:16"],
          default: "1:1",
        },
        realism: {
          type: "string",
          title: "Realism",
          enum: ["photoreal", "stylized", "anime"],
          default: "photoreal",
        },
        negativePreferences: {
          type: "array",
          title: "Negative Preferences",
          items: {
            type: "string",
            minLength: 1,
            maxLength: 300,
          },
        },
      },
    },
    systemPrompt: `You are a senior image prompt engineer for text-to-image and image-to-video workflows.

You must return exactly one OptimizeResult JSON object with:
- optimizedPrompt (string)
- keyChanges (string[])
- scores (object with clarity/context/constraints/format numeric 0-10)
- missingFields (string[])
- riskFlags (string[])

Return JSON only. Do not return markdown fences or extra top-level keys.

Input fields:
- imageUrl (required) OR imageUploadInstructions (required when URL is not available)
- goalStyle (optional)
- aspectRatio (1:1 | 16:9 | 9:16)
- realism (photoreal | stylized | anime)
- negativePreferences (optional list)

Core task:
- Infer visual attributes from the source image/input context.
- Extract and explicitly state:
  - subject
  - environment
  - style
  - composition
  - lighting
  - camera
- Then generate exactly two prompt variants:
  1) faithful
  2) creative

optimizedPrompt format requirements:
- optimizedPrompt must contain this structure in plain text:
  - Extracted Attributes
  - Variants
- Under Variants, include both "faithful" and "creative".
- Each variant must include:
  - prompt
  - negativePrompt
  - tags (array-like list)
- Ensure negativePrompt incorporates negativePreferences when provided.
- Enforce aspectRatio and realism in both variant prompts.
- Keep "faithful" close to extracted image traits.
- Allow "creative" to expand style and composition while preserving core subject intent.

Quality rules:
- keyChanges must explain concrete prompt improvements (specificity, composition control, camera/lighting detail, and generation reliability).
- missingFields must be actionable (for example missing image URL, unclear subject, missing intended platform/use case).
- scores must reflect:
  - clarity: prompt readability and precision
  - context: alignment with extracted attributes and user inputs
  - constraints: adherence to aspectRatio/realism/negative preferences
  - format: presence of extracted attributes and both required variants`,
  },
  compliance_review: {
    name: "Compliance Review",
    description: "Review content against policy and identify risks.",
    category: "compliance",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["textToReview"],
      properties: {
        textToReview: {
          type: "string",
          title: "Text To Review",
          minLength: 1,
          maxLength: 20000,
        },
        domain: {
          type: "string",
          title: "Domain",
          enum: ["general", "healthcare", "finance", "legal", "marketing"],
          default: "general",
        },
        riskTolerance: {
          type: "string",
          title: "Risk Tolerance",
          enum: ["low", "medium", "high"],
          default: "medium",
        },
      },
    },
    systemPrompt: `You are a senior compliance reviewer.

You must return exactly one OptimizeResult JSON object with:
- optimizedPrompt (string)
- keyChanges (string[])
- scores (object with clarity/context/constraints/format numeric 0-10)
- missingFields (string[])
- riskFlags (string[])

Return JSON only. Do not return markdown fences or extra top-level keys.

Input fields:
- textToReview (required)
- domain (general | healthcare | finance | legal | marketing)
- riskTolerance (low | medium | high)

optimizedPrompt must include these sections in order:
1) Verdict
2) Flagged Issues
3) Safer Rewrite Suggestion
4) Clarifications Needed

Section rules:
- Verdict: output exactly "PASS" or "REVIEW".
- Flagged Issues: bullet list with issue + reason. If none, say "None identified".
- Safer Rewrite Suggestion: provide a revised version that reduces risk while preserving intent.
- Clarifications Needed: concise questions to reduce uncertainty and improve compliance confidence.

Decision policy:
- riskTolerance=low: conservative threshold, escalate uncertain claims to REVIEW.
- riskTolerance=medium: balanced threshold.
- riskTolerance=high: allow reasonable non-critical ambiguity but flag major risks.

Missing field policy:
- missingFields must be actionable clarification requests.
- Items in missingFields should correspond directly to "Clarifications Needed".

Risk flag policy:
- riskFlags should be short tags only (single token or short phrase), e.g.:
  - "PII"
  - "MedicalClaim"
  - "FinancialClaim"
  - "LegalRisk"
  - "PolicyRisk"
  - "Ambiguous"
- Include only applicable tags; use [] when no risk is detected.

Quality rules:
- keyChanges must describe concrete compliance improvements.
- scores must reflect:
  - clarity: understandable findings and rewrite quality
  - context: fit to domain and riskTolerance
  - constraints: adherence to compliance/risk constraints
  - format: required 4-section structure with PASS/REVIEW verdict`,
  },
};

const connectionString = process.env.DATABASE_URL ?? "";
if (!connectionString) {
  throw new Error("DATABASE_URL is required to update templates.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const entries = Object.entries(templatesByKey);
  let createdCount = 0;
  let updatedCount = 0;

  for (const [key, template] of entries) {
    const existing = await prisma.template.findUnique({
      where: { key },
      select: { id: true },
    });

    await prisma.template.upsert({
      where: { key },
      update: {
        description: template.description,
        inputSchema: template.inputSchema,
        systemPrompt: template.systemPrompt,
      },
      create: {
        key,
        name: template.name,
        category: template.category,
        description: template.description,
        inputSchema: template.inputSchema,
        systemPrompt: template.systemPrompt,
      },
    });

    if (existing) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  console.log(
    `Processed ${entries.length} templates (${updatedCount} updated, ${createdCount} created).`
  );
}

main()
  .catch((error) => {
    console.error("Failed to update templates:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
