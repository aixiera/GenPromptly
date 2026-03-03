"use client";

import { useState } from "react";
import { apiPost } from "../lib/apiClient";
import { useProjects } from "../lib/hooks/useProjects";
import { usePrompts } from "../lib/hooks/usePrompts";

const stats = [
  ["Prompts Count", "1,284", "+12%"],
  ["Optimize Count", "3,942", "+8%"],
  ["Compliance Pass Rate", "96.7%", "HIPAA+FINRA"],
  ["Model Cost", "$2,390", "-6%"],
];

type DashboardProps = {
  selectedProjectId: string | null;
  selectedPromptId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectPrompt: (promptId: string) => void;
};

export function Dashboard({
  selectedProjectId,
  selectedPromptId,
  onSelectProject,
  onSelectPrompt,
}: DashboardProps) {
  const { data: projects, isLoading, error, refetch } = useProjects();
  const {
    data: prompts,
    isLoading: isPromptsLoading,
    error: promptsError,
  } = usePrompts(selectedProjectId);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = newProjectName.trim();
    if (!name) {
      setCreateError("Project name is required");
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateMessage(null);

    try {
      await apiPost("/api/projects", { name });
      setNewProjectName("");
      setCreateMessage("Project created");
      await refetch();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

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
        <div className="row-between">
          <h3>Projects</h3>
          <form
            onSubmit={handleCreateProject}
            style={{ display: "flex", gap: "8px", alignItems: "center" }}
          >
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="New Project"
              style={{
                padding: "10px",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                minWidth: "220px",
              }}
            />
            <button type="submit" className="btn primary" disabled={isCreating}>
              {isCreating ? "Creating..." : "Add"}
            </button>
          </form>
        </div>
        {createMessage && <p className="muted">{createMessage}</p>}
        {createError && <p className="muted">{createError}</p>}
        {isLoading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="muted">{error}</p>
        ) : !projects || projects.length === 0 ? (
          <p>No projects yet</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Org</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.orgId ?? "-"}</td>
                  <td>{new Date(project.updatedAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => onSelectProject(project.id)}
                    >
                      {selectedProjectId === project.id ? "Selected" : "View Prompts"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="table-wrap">
        <h3>Prompts</h3>
        {!selectedProjectId ? (
          <p>Select a project to view prompts.</p>
        ) : isPromptsLoading ? (
          <p>Loading...</p>
        ) : promptsError ? (
          <p className="muted">{promptsError}</p>
        ) : !prompts || prompts.length === 0 ? (
          <p>No prompts yet</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((prompt) => (
                <tr key={prompt.id}>
                  <td>{prompt.title}</td>
                  <td>{new Date(prompt.updatedAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => onSelectPrompt(prompt.id)}
                    >
                      {selectedPromptId === prompt.id ? "Selected" : "Open Editor"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
