export function ScoreCard() {
  return (
    <div className="score-card">
      <div>
        <p>Clarity Score</p>
        <h3>93 / 100</h3>
      </div>
      <ul>
        <li>+ JSON schema constraints</li>
        <li>+ Explicit role and audience</li>
        <li>- Add one more safety boundary</li>
      </ul>
    </div>
  );
}