export async function optimizePrompt(prompt: string) {
  return Promise.resolve({
    optimized: `${prompt}\n\n# Constraints\n- output strict JSON\n- apply HIPAA/FINRA filters`,
    score: 93,
    reasons: ["Added schema fields", "Improved compliance instructions"],
  });
}