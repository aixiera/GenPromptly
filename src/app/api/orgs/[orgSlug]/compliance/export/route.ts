import { NextResponse } from "next/server";
import prisma from "../../../../../../lib/db";
import { error, success } from "../../../../../../lib/api/response";
import { HttpError } from "../../../../../../lib/api/httpError";
import { logUnhandledApiError, toInfraHttpError } from "../../../../../../lib/api/errorDiagnostics";
import { requireAuthContextWithoutOrg } from "../../../../../../lib/auth/server";
import { requirePermission } from "../../../../../../lib/rbac";
import { OrganizationSlugSchema } from "../../../../../../lib/validation/team";
import { enforceRateLimit } from "../../../../../../lib/security/rateLimit";
import {
  buildComplianceReport,
  parseComplianceFramework,
  type ComplianceFramework,
} from "../../../../../../lib/compliance";
import { getRequestAuditContext, logAuditEvent } from "../../../../../../lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: { orgSlug: string } | Promise<{ orgSlug: string }>;
};

function resolveMembershipBySlug(
  memberships: Array<{ id: string; role: "OWNER" | "ADMIN" | "MEMBER"; org: { id: string; slug: string } }>,
  orgSlug: string
) {
  return memberships.find((entry) => entry.org.slug === orgSlug) ?? null;
}

function parseRequestedFramework(url: URL): ComplianceFramework | null {
  const raw = url.searchParams.get("framework");
  if (!raw) {
    return null;
  }
  if (raw.length > 30) {
    throw new HttpError(400, "VALIDATION_ERROR", "Framework filter is too long");
  }
  const parsed = parseComplianceFramework(raw);
  if (!parsed) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid compliance framework filter", { framework: raw });
  }
  return parsed;
}

function parseFormat(url: URL): "json" | "csv" {
  const raw = url.searchParams.get("format")?.trim().toLowerCase();
  if (raw && raw.length > 10) {
    throw new HttpError(400, "VALIDATION_ERROR", "Export format is too long");
  }
  if (!raw || raw === "json") {
    return "json";
  }
  if (raw === "csv") {
    return "csv";
  }
  throw new HttpError(400, "VALIDATION_ERROR", "Invalid export format", { format: raw });
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function renderCsv(report: Awaited<ReturnType<typeof buildComplianceReport>>): string {
  const lines: string[] = [];
  lines.push("Section,Field,Value");
  lines.push(`Meta,Generated At,${escapeCsvCell(report.generatedAt)}`);
  lines.push(`Meta,Framework,${escapeCsvCell(report.appliedFramework)}`);
  lines.push(`Risk,Score,${report.risk.score}`);
  lines.push(`Risk,Level,${report.risk.level}`);
  lines.push(`Risk,Rationale,${escapeCsvCell(report.risk.rationale)}`);

  report.summary.forEach((entry) => {
    lines.push(`Summary,${escapeCsvCell(`${entry.framework} Status`)},${entry.status}`);
    lines.push(`Summary,${escapeCsvCell(`${entry.framework} Pass Rate`)},${entry.passRate ?? "N/A"}`);
    lines.push(`Summary,${escapeCsvCell(`${entry.framework} Warnings`)},${entry.warnings}`);
    lines.push(`Summary,${escapeCsvCell(`${entry.framework} Last Checked`)},${entry.lastCheckedAt ?? "N/A"}`);
  });

  lines.push("Issues,Framework,Title,Severity,Prompt,Detected At,Details");
  report.issues.forEach((issue) => {
    lines.push(
      [
        "Issues",
        issue.framework,
        escapeCsvCell(issue.title),
        issue.severity,
        escapeCsvCell(issue.promptTitle ?? issue.promptId ?? "-"),
        issue.detectedAt,
        escapeCsvCell(issue.details),
      ].join(",")
    );
  });

  lines.push("Change Log,Who,Action,Category,When,Details");
  report.changeLog.forEach((entry) => {
    lines.push(
      [
        "Change Log",
        escapeCsvCell(entry.who),
        escapeCsvCell(entry.action),
        entry.category ?? "-",
        entry.createdAt,
        escapeCsvCell(entry.details),
      ].join(",")
    );
  });

  return lines.join("\n");
}

function buildFilename(orgSlug: string, format: "json" | "csv"): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `compliance-report-${orgSlug}-${stamp}.${format}`;
}

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { orgSlug } = await ctx.params;
    const parsedSlug = OrganizationSlugSchema.safeParse(orgSlug);
    if (!parsedSlug.success) {
      return NextResponse.json(error("VALIDATION_ERROR", "Invalid organization slug", parsedSlug.error.flatten()), {
        status: 400,
      });
    }
    const auth = await requireAuthContextWithoutOrg(req);
    const orgMembership = resolveMembershipBySlug(auth.memberships, parsedSlug.data);
    if (!orgMembership) {
      return NextResponse.json(error("NOT_FOUND", "Organization not found"), { status: 404 });
    }
    requirePermission({ ...auth, role: orgMembership.role }, "view_project");

    const url = new URL(req.url);
    const format = parseFormat(url);
    const framework = parseRequestedFramework(url);
    const rateLimitDecision = await enforceRateLimit(
      req,
      "exportOperation",
      {
        userId: auth.userId,
        orgId: orgMembership.org.id,
        action: `compliance-${format}-${framework ?? "all"}`,
      },
      "api.orgs.compliance.export.get"
    );
    if (!rateLimitDecision.ok) {
      return rateLimitDecision.response;
    }
    try {
      const report = await buildComplianceReport(orgMembership.org.id, { framework, issueLimit: 500 });

      const auditCtx = getRequestAuditContext(req);
      await prisma.$transaction(async (tx) => {
        await logAuditEvent(tx, {
          orgId: orgMembership.org.id,
          userId: auth.userId,
          action: "EXPORT_COMPLIANCE_REPORT",
          resourceType: "ComplianceReport",
          resourceId: `${orgMembership.org.id}:${format}`,
          metadata: {
            format,
            framework: framework ?? "ALL",
            issueCount: report.issues.length,
          },
          ...auditCtx,
        });
      });

      const filename = buildFilename(parsedSlug.data, format);
      if (format === "csv") {
        return new NextResponse(renderCsv(report), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }

      return NextResponse.json(success(report), {
        status: 200,
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } finally {
      rateLimitDecision.release?.();
    }
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return NextResponse.json(error(err.code, err.message, err.details), { status: err.status });
    }
    const infraError = toInfraHttpError(err, "api.orgs.compliance.export.get");
    if (infraError) {
      return NextResponse.json(error(infraError.code, infraError.message, infraError.details), {
        status: infraError.status,
      });
    }
    logUnhandledApiError("api.orgs.compliance.export.get", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to export compliance report"), { status: 500 });
  }
}
