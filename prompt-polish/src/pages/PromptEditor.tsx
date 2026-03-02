import { ComplianceBadge } from "../components/ComplianceBadge";
import { PromptDiff } from "../components/PromptDiff";
import { ScoreCard } from "../components/ScoreCard";
import { VariablePanel } from "../components/VariablePanel";

export function PromptEditor() {
  return (
    <section className="panel">
      <h2>Prompt Editor(Three Columns)</h2>
      <div className="editor-grid">
        <article className="editor-col">
          <h4>Industry Templates</h4>
          <select><option>Healthcare - Patient Summary</option><option>Finance - Compliance Memo</option></select>
          <VariablePanel />
        </article>

        <article className="editor-col">
          <div className="row-between"><h4>Prompt Editor</h4><span>Version v12</span></div>
          <textarea rows={14} defaultValue="You are a compliance-aware assistant. Return strict JSON only with keys: summary, controls, risk_level, disclaimer." />
          <p className="muted">Token count: 348</p>
          <PromptDiff />
        </article>

        <article className="editor-col">
          <h4>Optimized Prompt</h4>
          <div className="output-box">Added structured output schema, legal-safe constraints, and explicit variable references.</div>
          <ScoreCard />
          <div className="badge-row"><ComplianceBadge label="HIPAA" /><ComplianceBadge label="FINRA" /></div>
          <pre>{`{\n  "summary": "...",\n  "risk_level": "low",\n  "controls": ["mask pii"],\n  "disclaimer": "not legal advice"\n}`}</pre>
        </article>
      </div>
    </section>
  );
}