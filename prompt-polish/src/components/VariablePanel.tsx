export function VariablePanel() {
  return (
    <div className="card-block">
      <h4>Variables</h4>
      <div className="chip-list">
        <span className="chip">{"{audience}"}</span>
        <span className="chip">{"{tone}"}</span>
        <span className="chip">{"{risk_level}"}</span>
        <span className="chip">{"{jurisdiction}"}</span>
      </div>
      <textarea placeholder="Goal & context settings..." rows={6} />
    </div>
  );
}