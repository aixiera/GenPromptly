import type { ComplianceModelProfile } from "./types";

export const complianceModelProfiles: ComplianceModelProfile[] = [
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    schemaAdherence: 93,
    latencyMs: 2200,
    costUsdPer1kTokens: 0.013,
    complianceFriendliness: 90,
    outputControl: "High",
    fallbackReadiness: "Ready",
    notes: "Strong structured-output reliability and predictable formatting under tight templates.",
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    schemaAdherence: 88,
    latencyMs: 980,
    costUsdPer1kTokens: 0.0032,
    complianceFriendliness: 84,
    outputControl: "High",
    fallbackReadiness: "Ready",
    notes: "Cost-efficient fallback with good guardrail adherence for routine compliance checks.",
  },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    schemaAdherence: 86,
    latencyMs: 1900,
    costUsdPer1kTokens: 0.011,
    complianceFriendliness: 82,
    outputControl: "Medium",
    fallbackReadiness: "Partial",
    notes: "High quality natural-language output; requires tighter schema post-validation.",
  },
];
