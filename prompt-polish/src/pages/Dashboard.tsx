const stats = [
  ["Prompts Count", "1,284", "+12%"],
  ["Optimize Count", "3,942", "+8%"],
  ["Compliance Pass Rate", "96.7%", "HIPAA+FINRA"],
  ["Model Cost", "$2,390", "-6%"],
];

export function Dashboard() {
  return (
    <section className="panel">
      <h2>Dashboard</h2>
      <div className="stats-grid">
        {stats.map(([label, value, sub]) => (
          <article className="stat" key={label}>
            <p>{label}</p>
            <h3>{value}</h3>
            <span>{sub}</span>
          </article>
        ))}
      </div>
      <div className="table-wrap">
        <h3>Recent Prompt List</h3>
        <table>
          <thead><tr><th>Prompt</th><th>Type</th><th>Owner</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Medical discharge summary parser</td><td>Healthcare</td><td>Alice</td><td>Passed</td></tr>
            <tr><td>FINRA transcript risk checker</td><td>Finance</td><td>Ben</td><td>Review</td></tr>
            <tr><td>Campaign idea JSON generator</td><td>Marketing</td><td>Yuna</td><td>Passed</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}