export async function compareModels() {
  return Promise.resolve([
    { model: "gpt-4o", latencyMs: 1800, score: 91 },
    { model: "claude-3.5-sonnet", latencyMs: 2200, score: 88 },
  ]);
}