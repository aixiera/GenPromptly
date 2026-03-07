import prisma from "../db";
import { complianceModelProfiles } from "./modelProfiles";
import {
  COMPLIANCE_FRAMEWORKS,
  type ComplianceCategoryStatus,
  type ComplianceChangeLogEntry,
  type ComplianceFramework,
  type ComplianceIssue,
  type ComplianceIssueSeverity,
  type ComplianceReport,
  type ComplianceRiskOverview,
} from "./types";

const frameworkMeta: Record<
  ComplianceFramework,
  {
    title: string;
    description: string;
  }
> = {
  HIPAA: {
    title: "HIPAA readiness",
    description: "Sensitive healthcare wording and PHI-related prompt safeguards.",
  },
  FINRA: {
    title: "FINRA wording checks",
    description: "Financial communication controls and disclaimer hygiene.",
  },
  PCI_DSS: {
    title: "PCI-DSS handling",
    description: "Payment-card data redaction and prohibited storage phrasing.",
  },
  INTERNAL_POLICY: {
    title: "Prompt policy completeness",
    description: "Internal policy guardrails, required fields, and consistency checks.",
  },
};

const frameworkOrder: ComplianceFramework[] = [...COMPLIANCE_FRAMEWORKS];

const highRiskTerms = ["unsafe", "legal_risk", "sensitive", "pii", "phi", "hallucination"];

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function classifyRiskFlag(flag: string): ComplianceFramework[] {
  const token = normalizeToken(flag);
  const matches = new Set<ComplianceFramework>();

  if (token.includes("hipaa") || token.includes("phi") || token.includes("medical") || token.includes("patient")) {
    matches.add("HIPAA");
  }
  if (
    token.includes("finra") ||
    token.includes("financial") ||
    token.includes("investment") ||
    token.includes("disclaimer")
  ) {
    matches.add("FINRA");
  }
  if (
    token.includes("pci") ||
    token.includes("payment") ||
    token.includes("card") ||
    token.includes("pan") ||
    token.includes("cvv")
  ) {
    matches.add("PCI_DSS");
  }
  if (matches.size === 0) {
    matches.add("INTERNAL_POLICY");
  }
  return Array.from(matches);
}

function severityFromRiskFlag(flag: string): ComplianceIssueSeverity {
  const token = normalizeToken(flag);
  if (highRiskTerms.some((term) => token.includes(term))) {
    return "HIGH";
  }
  if (token.includes("warning") || token.includes("needs_review")) {
    return "MEDIUM";
  }
  return "LOW";
}

function severityFromMissingField(field: string): ComplianceIssueSeverity {
  const token = normalizeToken(field);
  if (token.includes("policy") || token.includes("risk") || token.includes("constraint")) {
    return "HIGH";
  }
  if (token.includes("format") || token.includes("audience")) {
    return "MEDIUM";
  }
  return "LOW";
}

function titleCaseSnake(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function actionToLabel(action: string): string {
  return titleCaseSnake(action);
}

function classifyActionFramework(action: string): ComplianceFramework | null {
  const token = normalizeToken(action);
  if (token.includes("template") || token.includes("prompt")) {
    return "INTERNAL_POLICY";
  }
  if (token.includes("invite") || token.includes("member") || token.includes("role")) {
    return "INTERNAL_POLICY";
  }
  if (token.includes("compliance")) {
    return "INTERNAL_POLICY";
  }
  if (token.includes("finra")) {
    return "FINRA";
  }
  if (token.includes("hipaa")) {
    return "HIPAA";
  }
  if (token.includes("pci")) {
    return "PCI_DSS";
  }
  return null;
}

function pickAuditDetails(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") {
    return "No metadata";
  }
  const allowedKeys = [
    "projectName",
    "projectId",
    "promptId",
    "promptName",
    "skillKey",
    "toolKey",
    "mode",
    "requestedMode",
    "model",
    "email",
    "previousRole",
    "nextRole",
  ];
  const entries = allowedKeys
    .map((key) => {
      if (!(key in metadata)) {
        return null;
      }
      const raw = (metadata as Record<string, unknown>)[key];
      if (raw === null || raw === undefined) {
        return null;
      }
      return `${titleCaseSnake(key)}: ${String(raw)}`;
    })
    .filter((entry): entry is string => entry !== null);

  if (entries.length === 0) {
    return "Metadata recorded";
  }
  return entries.join(" | ");
}

function buildRiskOverview(issues: ComplianceIssue[], changeLog: ComplianceChangeLogEntry[]): ComplianceRiskOverview {
  const riskFlagIssues = issues.filter((issue) => issue.title.startsWith("Risk flag"));
  const missingFieldIssues = issues.filter((issue) => issue.title.startsWith("Missing field"));
  const highSeverityIssues = issues.filter((issue) => issue.severity === "HIGH");
  const anomalyEvents = changeLog.filter((entry) => {
    const token = normalizeToken(entry.action);
    return (
      token.includes("delete") ||
      token.includes("remove") ||
      token.includes("revoke") ||
      token.includes("change member role")
    );
  });

  const factors = [
    {
      key: "risk_flags",
      label: "Recent risk flags",
      value: riskFlagIssues.length,
      weight: 4,
      contribution: Math.min(40, riskFlagIssues.length * 4),
    },
    {
      key: "high_severity",
      label: "High-severity findings",
      value: highSeverityIssues.length,
      weight: 8,
      contribution: Math.min(30, highSeverityIssues.length * 8),
    },
    {
      key: "missing_fields",
      label: "Missing required fields",
      value: missingFieldIssues.length,
      weight: 3,
      contribution: Math.min(20, missingFieldIssues.length * 3),
    },
    {
      key: "audit_anomalies",
      label: "Audit anomalies",
      value: anomalyEvents.length,
      weight: 2,
      contribution: Math.min(10, anomalyEvents.length * 2),
    },
  ];

  const score = Math.min(100, factors.reduce((acc, factor) => acc + factor.contribution, 0));
  const level = score >= 67 ? "High" : score >= 34 ? "Medium" : "Low";
  const rationale =
    issues.length === 0
      ? "No compliance findings recorded yet. Run optimizations to generate compliance signals."
      : `Risk is ${level.toLowerCase()} based on ${issues.length} findings and ${anomalyEvents.length} audit anomalies.`;

  return {
    score,
    level,
    rationale,
    factors,
  };
}

function parseFramework(raw: string | null | undefined): ComplianceFramework | null {
  const token = raw?.trim().toUpperCase();
  if (!token) {
    return null;
  }
  if (token === "PCI-DSS" || token === "PCI_DSS") {
    return "PCI_DSS";
  }
  if (token === "INTERNAL" || token === "INTERNAL_POLICY") {
    return "INTERNAL_POLICY";
  }
  if (token === "HIPAA" || token === "FINRA") {
    return token;
  }
  return null;
}

export function parseComplianceFramework(raw: string | null | undefined): ComplianceFramework | null {
  return parseFramework(raw);
}

export async function buildComplianceReport(
  orgId: string,
  options?: { framework?: ComplianceFramework | null; issueLimit?: number }
): Promise<ComplianceReport> {
  const appliedFramework = options?.framework ?? null;
  const issueLimit = Math.max(5, Math.min(500, options?.issueLimit ?? 120));
  // Keep this read path out of DB transactions. Under pooled connections, BEGIN can time out
  // during traffic bursts even when individual reads are fast.
  const promptCount = await prisma.prompt.count({
    where: { orgId },
  });
  const versionRows = await prisma.promptVersion.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 250,
    select: {
      id: true,
      promptId: true,
      createdAt: true,
      riskFlags: true,
      missingFields: true,
      prompt: {
        select: {
          title: true,
        },
      },
    },
  });
  const auditRows = await prisma.auditLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: {
      id: true,
      createdAt: true,
      action: true,
      metadata: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const issues: ComplianceIssue[] = [];
  for (const row of versionRows) {
    const riskFlags = toStringArray(row.riskFlags);
    const missingFields = toStringArray(row.missingFields);
    const detectedAt = row.createdAt.toISOString();
    const promptTitle = row.prompt?.title ?? null;

    riskFlags.forEach((flag, index) => {
      const frameworks = classifyRiskFlag(flag);
      const severity = severityFromRiskFlag(flag);
      frameworks.forEach((framework) => {
        issues.push({
          id: `${row.id}-risk-${index}-${framework}`,
          framework,
          promptId: row.promptId,
          promptTitle,
          title: `Risk flag: ${titleCaseSnake(flag)}`,
          details: `Detected risk flag "${flag}" during optimize output validation.`,
          severity,
          detectedAt,
        });
      });
    });

    missingFields.forEach((field, index) => {
      issues.push({
        id: `${row.id}-missing-${index}`,
        framework: "INTERNAL_POLICY",
        promptId: row.promptId,
        promptTitle,
        title: `Missing field: ${titleCaseSnake(field)}`,
        details: `Required field "${field}" is missing from optimize output.`,
        severity: severityFromMissingField(field),
        detectedAt,
      });
    });
  }

  const sortedIssues = issues.sort((left, right) => right.detectedAt.localeCompare(left.detectedAt));
  const filteredIssues = appliedFramework
    ? sortedIssues.filter((issue) => issue.framework === appliedFramework)
    : sortedIssues;

  const changeLog: ComplianceChangeLogEntry[] = auditRows
    .map((row) => {
      const category = classifyActionFramework(row.action);
      if (appliedFramework && category && category !== appliedFramework) {
        return null;
      }
      return {
        id: row.id,
        who: row.user?.name || row.user?.email || "System",
        action: actionToLabel(row.action),
        details: pickAuditDetails(row.metadata),
        category,
        createdAt: row.createdAt.toISOString(),
      };
    })
    .filter((entry): entry is ComplianceChangeLogEntry => entry !== null);

  const summary = frameworkOrder.map((framework) => {
    const findings = sortedIssues.filter((issue) => issue.framework === framework);
    const checkedItems =
      framework === "INTERNAL_POLICY" ? Math.max(promptCount, versionRows.length) : versionRows.length;
    const warnings = findings.length;
    const passRate =
      checkedItems === 0 ? null : Math.max(0, Math.min(100, (checkedItems - warnings) / checkedItems * 100));
    const status: ComplianceCategoryStatus =
      checkedItems === 0
        ? "NO_DATA"
        : warnings === 0
          ? "PASS"
          : passRate !== null && passRate >= 75
            ? "WARN"
            : "ACTION_REQUIRED";
    const latestFindingAt = findings[0]?.detectedAt ?? versionRows[0]?.createdAt.toISOString() ?? null;

    return {
      framework,
      title: frameworkMeta[framework].title,
      description: frameworkMeta[framework].description,
      status,
      passRate,
      warnings,
      checkedItems,
      lastCheckedAt: latestFindingAt,
    };
  });

  const risk = buildRiskOverview(filteredIssues, changeLog);

  return {
    orgId,
    generatedAt: new Date().toISOString(),
    appliedFramework: appliedFramework ?? "ALL",
    summary,
    risk,
    issues: filteredIssues.slice(0, issueLimit),
    changeLog,
    modelProfiles: complianceModelProfiles,
    hasSignals: versionRows.length > 0 || auditRows.length > 0,
  };
}
