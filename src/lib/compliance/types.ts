export const COMPLIANCE_FRAMEWORKS = ["HIPAA", "FINRA", "PCI_DSS", "INTERNAL_POLICY"] as const;

export type ComplianceFramework = (typeof COMPLIANCE_FRAMEWORKS)[number];

export type ComplianceCategoryStatus = "PASS" | "WARN" | "ACTION_REQUIRED" | "NO_DATA";

export type ComplianceCategorySummary = {
  framework: ComplianceFramework;
  title: string;
  description: string;
  status: ComplianceCategoryStatus;
  passRate: number | null;
  warnings: number;
  checkedItems: number;
  lastCheckedAt: string | null;
};

export type ComplianceRiskFactor = {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
};

export type ComplianceRiskOverview = {
  score: number;
  level: "Low" | "Medium" | "High";
  rationale: string;
  factors: ComplianceRiskFactor[];
};

export type ComplianceIssueSeverity = "LOW" | "MEDIUM" | "HIGH";

export type ComplianceIssue = {
  id: string;
  framework: ComplianceFramework;
  promptId: string | null;
  promptTitle: string | null;
  title: string;
  details: string;
  severity: ComplianceIssueSeverity;
  detectedAt: string;
};

export type ComplianceChangeLogEntry = {
  id: string;
  who: string;
  action: string;
  details: string;
  category: ComplianceFramework | null;
  createdAt: string;
};

export type ComplianceModelProfile = {
  id: string;
  name: string;
  schemaAdherence: number;
  latencyMs: number;
  costUsdPer1kTokens: number;
  complianceFriendliness: number;
  outputControl: "High" | "Medium" | "Low";
  fallbackReadiness: "Ready" | "Partial" | "Planned";
  notes: string;
};

export type ComplianceReport = {
  orgId: string;
  generatedAt: string;
  appliedFramework: ComplianceFramework | "ALL";
  summary: ComplianceCategorySummary[];
  risk: ComplianceRiskOverview;
  issues: ComplianceIssue[];
  changeLog: ComplianceChangeLogEntry[];
  modelProfiles: ComplianceModelProfile[];
  hasSignals: boolean;
};
