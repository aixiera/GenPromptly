const models = [
  { name: "GPT-4o", cost: "$0.021", latency: "1.8s", score: 91 },
  { name: "Claude 3.5 Sonnet", cost: "$0.018", latency: "2.2s", score: 88 },
];

export function ModelCompare() {
  return (
    <section className="panel">
      <h2>Model Compare</h2>
      <div className="compare-grid">
        {models.map((m) => (
          <article className="compare-card" key={m.name}>
            <h3>{m.name}</h3>
            <div className="output-box">Structured output with better schema adherence and citation consistency.</div>
            <ul>
              <li>Token Cost: {m.cost}</li>
              <li>Latency: {m.latency}</li>
              <li>Quality Score: {m.score}</li>
            </ul>
            <label>Fallback model</label>
            <select><option>Auto fallback enabled</option><option>GPT-4o mini</option><option>Claude Haiku</option></select>
          </article>
        ))}
      </div>
    </section>
  );
}