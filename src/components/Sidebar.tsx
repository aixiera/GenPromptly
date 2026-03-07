export type AppPage = "dashboard" | "editor" | "templates" | "team" | "compliance";

const menu = [
  { key: "dashboard", label: "Dashboard" },
  { key: "editor", label: "Prompts" },
  { key: "templates", label: "Tools" },
  { key: "compliance", label: "Compliance" },
  { key: "team", label: "Team" },
] as const;

export function Sidebar({ active, onChange }: { active: AppPage; onChange: (page: AppPage) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand-box">
        <div className="brand-mark" />
        <div>
          <p className="brand-title">GenPromptly</p>
          <p className="brand-subtitle">B2B SaaS</p>
        </div>
      </div>
      <nav className="side-nav">
        {menu.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${active === item.key ? "active" : ""}`}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
