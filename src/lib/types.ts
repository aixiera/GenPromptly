export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  orgId?: string | null;
};

export type Prompt = {
  id: string;
  projectId: string;
  templateId?: string | null;
  title: string;
  rawPrompt: string;
  createdAt: string;
  updatedAt: string;
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
  optimizedPrompt: string;
  keyChanges: string[];
  scores: OptimizeScores;
  missingFields: string[];
  riskFlags: string[];
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
