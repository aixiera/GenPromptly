import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../lib/apiClient";
import type { Template } from "../lib/types";

const LOADING_TEXT = "Loading tools...";
const EMPTY_TEXT = "No tools available yet.";

type TemplatesProps = {
  onSelectTemplate: (templateId: string) => void;
};

export function Templates({ onSelectTemplate }: TemplatesProps) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiGet<Template[]>("/api/templates");
      setTemplates(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch tools");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <section className="panel">
      <div className="row-between" style={{ marginBottom: "12px" }}>
        <h2>Tools</h2>
        <button type="button" className="btn ghost" onClick={refetch} disabled={isLoading}>
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {isLoading ? <p className="muted">{LOADING_TEXT}</p> : null}
      {error ? <p className="muted">{error}</p> : null}
      {!isLoading && !error && (!templates || templates.length === 0) ? (
        <p className="muted">{EMPTY_TEXT}</p>
      ) : null}

      {!isLoading && !error && templates && templates.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "10px",
          }}
        >
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="card-block"
              style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => onSelectTemplate(template.id)}
            >
              <h4 style={{ marginBottom: "6px" }}>{template.name}</h4>
              <p className="muted" style={{ marginBottom: "8px" }}>
                {template.description}
              </p>
              <span className="chip">{template.category}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
