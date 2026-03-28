export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  orgId: string;
};

export type Prompt = {
  id: string;
  projectId: string;
  orgId: string;
  templateId?: string | null;
  title: string;
  rawPrompt: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptListItem = Prompt & {
  project: {
    id: string;
    name: string;
  } | null;
  template: {
    id: string;
    key: string;
    name: string;
  } | null;
  versionCount: number;
  latestOptimizeAt: string | null;
  recentOptimizeStatus: "NOT_RUN" | "PASS" | "WARN";
};

export type Template = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  inputSchema: unknown;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
};

export type OptimizeScores = {
  clarity: number;
  context: number;
  constraints: number;
  format: number;
};

export type OptimizeResult = {
  optimizedPrompt: string;
  keyChanges: string[];
  scores: OptimizeScores;
  missingFields: string[];
  riskFlags: string[];
};

export type PromptVersion = {
  id: string;
  promptId: string;
  orgId: string;
  optimizedPrompt: string;
  keyChanges: string[];
  recommendations?: string[];
  scores: OptimizeScores;
  missingFields: string[];
  riskFlags: string[];
  structure?: Record<string, unknown>;
  structuredData?: Record<string, unknown>;
  skillKey?: string | null;
  toolKey?: string | null;
  workflowProfile?: string | null;
  mode: string;
  model: string;
  createdAt: string;
};

export type DashboardMetricSummary = {
  value: number | null;
  deltaPct: number | null;
};

export type DashboardSummary = {
  windowDays: number;
  projectCount: number;
  promptCount: number;
  versionCount: number;
  metrics: {
    promptsCount: DashboardMetricSummary;
    optimizeCount: DashboardMetricSummary;
    compliancePassRate: DashboardMetricSummary;
    modelCostUsd: DashboardMetricSummary;
  };
};
