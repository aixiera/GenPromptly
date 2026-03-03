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
  title: string;
  rawPrompt: string;
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
