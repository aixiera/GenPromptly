"use client";

import { useMemo, useState } from "react";

type NavKey = "dashboard" | "editor" | "compare" | "compliance";

type Metric = {
  label: string;
  value: string;
  trend: string;
};

const metrics: Metric[] = [
  { label: "Prompts Count", value: "1,284", trend: "+12% this month" },
  { label: "Optimize Count", value: "3,942", trend: "+8% this week" },
  { label: "Compliance Pass Rate", value: "96.7%", trend: "HIPAA + FINRA" },
  { label: "Model Cost", value: "$2,390", trend: "-6% vs last month" },
];

const navItems: { key: NavKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "editor", label: "Prompt Editor" },
  { key: "compare", label: "Model Compare" },
  { key: "compliance", label: "Compliance" },
];

const recentPrompts = [
  {
    title: "Healthcare discharge summary extraction",
    owner: "A. Chen",
    updatedAt: "2h ago",
    status: "Passed",
  },
  {
    title: "FINRA call transcript risk classifier",
    owner: "J. Martin",
    updatedAt: "5h ago",
    status: "Review",
  },
  {
    title: "Campaign slogan generator with JSON schema",
    owner: "R. Kim",
    updatedAt: "1d ago",
    status: "Passed",
  },
];

export default function Home() {
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");
  const [tokenCount, setTokenCount] = useState(348);
  const progressWidth = useMemo(() => `${Math.min(100, Math.max(0, tokenCount / 8))}%`, [tokenCount]);

  return (
        <main className="enterprise-app">
      <aside className="sidebar">
        <div className="brand">GenPromptly</div>
        <div className="workspace-chip">Enterprise Workspace</div>
        <nav>
          <p className="nav-caption">Core</p>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeNav === item.key ? "active" : ""}`}
              onClick={() => setActiveNav(item.key)}
            >
              {item.label}
            </button>
          ))}
          <p className="nav-caption">Team</p>
          <button className="nav-item">Templates</button>
          <button className="nav-item">Members & Roles</button>
          <button className="nav-item">Audit Logs</button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>Prompt Generator App</h1>
            <p>Compliance-first prompt engineering for healthcare, finance, and marketing teams.</p>
          </div>
          <div className="topbar-actions">
            <button className="ghost">Invite Team</button>
            <button className="primary">Create Prompt</button>
          </div>
        </header>

        <section className="panel dashboard-panel">
          <h2>1. 工作台 Dashboard</h2>
          <div className="metrics-grid">
            {metrics.map((item) => (
              <article key={item.label} className="metric-card">
                <p>{item.label}</p>
                <h3>{item.value}</h3>
                <span>{item.trend}</span>
              </article>
            ))}
          </div>
           <div className="table-card">
            <div className="table-title">
              <h3>Recent Prompts</h3>
              <button className="ghost small">View all</button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Owner</th>
                  <th>Updated</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPrompts.map((row) => (
                  <tr key={row.title}>
                    <td>{row.title}</td>
                    <td>{row.owner}</td>
                    <td>{row.updatedAt}</td>
                    <td>
                      <span className={`status ${row.status === "Passed" ? "passed" : "review"}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          </section>

        <section className="panel">
          <h2>2. 核心 Prompt 编辑器（三栏）</h2>
          <div className="editor-grid">
            <article className="editor-card">
              <h3>Industry Template</h3>
              <select>
                <option>Healthcare - Patient Summary</option>
                <option>Finance - Risk Disclosure</option>
                <option>Marketing - Brand Voice</option>
              </select>
              <h3>Variables</h3>
              <input placeholder="{audience}" />
              <input placeholder="{tone}" />
              <h3>Goal & Context</h3>
              <textarea placeholder="Describe goal, constraints, and context" />
            </article>

            <article className="editor-card middle">
              <div className="editor-header">
                <h3>Prompt Editor</h3>
                <span>Version v12</span>
              </div>
              <textarea
                defaultValue={`You are a compliance-aware assistant. Produce output in strict JSON format with fields: summary, risk_level, controls, disclaimer.`}
                onChange={(e) => setTokenCount(e.target.value.length)}
              />
              <div className="token-row">
                <span>Token Count: {tokenCount}</span>
                <div className="bar">
                  <div className="bar-inner" style={{ width: progressWidth }} />
                </div>
              </div>
            </article>

            <article className="editor-card">
              <h3>Optimized Prompt</h3>
              <div className="output-box">Clearer instructions, explicit role setup, and deterministic JSON schema added.</div>
              <h3>Clarity Score</h3>
              <p className="score">92 / 100</p>
              <h3>Compliance Check</h3>
              <div className="badge-row">
                <span className="badge">HIPAA</span>
                <span className="badge">FINRA</span>
              </div>
              <h3>JSON Output</h3>
              <pre>{`{\n  "summary": "...",\n  "risk_level": "medium",\n  "controls": ["mask pii", "retain logs"],\n  "disclaimer": "Not legal advice"\n}`}</pre>
            </article>
          </div>
        </section>

        <section className="panel">
          <h2>3. 多模型对比页面</h2>
          <div className="compare-grid">
            {[
              { name: "GPT-4o", tokenCost: "$0.021", latency: "1.8s", quality: 91 },
              { name: "Claude 3.5 Sonnet", tokenCost: "$0.018", latency: "2.2s", quality: 88 },
            ].map((model) => (
              <article key={model.name} className="compare-card">
                <h3>{model.name}</h3>
                <div className="output-box">Structured output with concise reasoning and fallback-safe schema validation.</div>
                <ul>
                  <li>Token Cost: {model.tokenCost}</li>
                  <li>Latency: {model.latency}</li>
                  <li>Quality Score: {model.quality}</li>
                </ul>
                <label>Fallback Model</label>
                <select>
                  <option>Auto (GPT-4o mini)</option>
                  <option>Claude Haiku</option>
                  <option>Gemini Flash</option>
                </select>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>4. 合规 & 审计日志页面</h2>
          <div className="compliance-head">
            <span className="badge">HIPAA</span>
            <span className="badge">FINRA</span>
            <span className="badge">PCI-DSS</span>
            <button className="primary small">Export Report</button>
          </div>
          <div className="risk">
            <p>Risk Level: Medium</p>
            <div className="bar">
              <div className="bar-inner" style={{ width: "58%" }} />
            </div>
          </div>
          <div className="table-card">
            <h3>Change History</h3>
            <table>
              <thead>
                <tr>
                  <th>Who</th>
                  <th>What</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Olivia (Compliance Lead)</td>
                  <td>Added PHI masking rule to healthcare template</td>
                  <td>2026-02-24 14:32</td>
                </tr>
                <tr>
                  <td>David (PM)</td>
                  <td>Updated financial disclaimer language for FINRA checks</td>
                  <td>2026-02-24 11:10</td>
                </tr>
                <tr>
                  <td>System</td>
                  <td>Fallback triggered for Claude latency over threshold</td>
                  <td>2026-02-24 09:55</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}