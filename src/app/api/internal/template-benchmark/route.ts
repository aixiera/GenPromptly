import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import { optimizePrompt } from "../../../../lib/ai/optimizer";
import { HttpError } from "../../../../lib/api/httpError";
import { error, success } from "../../../../lib/api/response";
import { logUnhandledApiError, toInfraHttpError } from "../../../../lib/api/errorDiagnostics";
import { requireAuthContext } from "../../../../lib/auth/server";
import { requirePermission } from "../../../../lib/rbac";
import { isOpenAiConfigured } from "../../../../lib/config/runtime";

export const runtime = "nodejs";

type BenchmarkRow = {
  templateKey: string;
  avgScore: number;
  testedCases: number;
};

const TEMPLATE_KEYS = [
  "workflow_spec",
  "email_pack",
  "marketing_variants",
  "video_script",
  "image_to_prompt",
  "compliance_review",
] as const;

const BENCHMARK_CASES: Record<(typeof TEMPLATE_KEYS)[number], string[]> = {
  workflow_spec: [
    "Build a workflow to classify customer support tickets and route urgent items to on-call.",
    "Create a workflow to extract entities from invoices and validate totals.",
    "Design a workflow to produce weekly compliance summaries for leadership.",
  ],
  email_pack: [
    "Draft a customer follow-up email with clear next steps after onboarding call.",
    "Write a renewal reminder email with concise CTA and professional tone.",
    "Write an apology email after service incident with transparent update.",
  ],
  marketing_variants: [
    "Generate marketing copy variants for a SaaS analytics launch on LinkedIn.",
    "Create variants for a productivity app campaign targeting students.",
    "Create variants for a fintech product landing page emphasizing trust.",
  ],
  video_script: [
    "Create a 45-second product demo script with timeline and shot details.",
    "Create a short ad script for social media with visual prompts.",
    "Create a documentary-style explainer script for onboarding flow.",
  ],
  image_to_prompt: [
    "Convert a product image into prompts for a clean ecommerce hero visual.",
    "Convert a portrait image into faithful and creative prompt variants.",
    "Convert a landscape image into cinematic visual generation prompts.",
  ],
  compliance_review: [
    "Review marketing copy with aggressive performance claims.",
    "Review financial advice snippet for risky guarantees.",
    "Review healthcare recommendation text for unsafe medical claims.",
  ],
};

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toCompositeScore(scores: {
  clarity: number;
  context: number;
  constraints: number;
  format: number;
}): number {
  return average([scores.clarity, scores.context, scores.constraints, scores.format]);
}

export async function GET(req: Request) {
  if (!isOpenAiConfigured()) {
    return NextResponse.json(error("SERVICE_UNAVAILABLE", "Optimizer is not configured yet"), { status: 503 });
  }

  try {
    const auth = await requireAuthContext(req);
    requirePermission(auth, "benchmark_template");

    const templates = await prisma.template.findMany({
      where: {
        key: {
          in: [...TEMPLATE_KEYS],
        },
      },
      select: {
        key: true,
        systemPrompt: true,
      },
    });

    const templateMap = new Map(templates.map((template) => [template.key, template.systemPrompt]));
    const rows: BenchmarkRow[] = [];

    for (const templateKey of TEMPLATE_KEYS) {
      const templatePrompt = templateMap.get(templateKey) ?? null;
      if (!templatePrompt) {
        rows.push({
          templateKey,
          avgScore: 0,
          testedCases: 0,
        });
        continue;
      }

      const testCases = BENCHMARK_CASES[templateKey];
      const scores: number[] = [];

      for (const testInput of testCases) {
        try {
          const result = await optimizePrompt(testInput, "clarity", undefined, templatePrompt);
          scores.push(toCompositeScore(result.scores));
        } catch (benchmarkError: unknown) {
          console.error("Template benchmark case failed", {
            templateKey,
            message: benchmarkError instanceof Error ? benchmarkError.message : String(benchmarkError),
          });
        }
      }

      rows.push({
        templateKey,
        avgScore: Number(average(scores).toFixed(2)),
        testedCases: testCases.length,
      });
    }

    return NextResponse.json(success(rows), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.internal.template-benchmark.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.internal.template-benchmark.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to run template benchmark"), { status: 500 });
  }
}
