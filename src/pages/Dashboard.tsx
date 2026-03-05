"use client";

import { useState } from "react";
import { apiDelete, apiPost, getApiErrorMessage } from "../lib/apiClient";
import { useDashboardSummary } from "../lib/hooks/useDashboardSummary";
import { useProjects } from "../lib/hooks/useProjects";
import { usePrompts } from "../lib/hooks/usePrompts";
import type { Prompt } from "../lib/types";

const LOADING_TEXT = "Loading data...";
const EMPTY_PROJECTS_TEXT = "No projects yet.";
const EMPTY_PROMPTS_TEXT = "No prompts yet.";
const DEFAULT_WINDOW_DAYS = 7;

function formatWholeNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercentage(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDelta(deltaPct: number | null | undefined, windowDays: number): string {
  if (typeof deltaPct !== "number" || !Number.isFinite(deltaPct)) {
    return "No prior data";
  }

  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}% vs prev ${windowDays}d`;
}

type DashboardProps = {
  selectedProjectId: string | null;
  selectedPromptId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectPrompt: (promptId: string | null) => void;
};

export function Dashboard({
  selectedProjectId,
  selectedPromptId,
  onSelectProject,
  onSelectPrompt,
}: DashboardProps) {
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useDashboardSummary();
  const { data: projects, isLoading, error, refetch } = useProjects();
  const {
    data: prompts,
    isLoading: isPromptsLoading,
    error: promptsError,
    refetch: refetchPrompts,
  } = usePrompts(selectedProjectId);

  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [newPromptTitle, setNewPromptTitle] = useState("");
  const [newPromptRawPrompt, setNewPromptRawPrompt] = useState("");
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);
  const [createPromptMessage, setCreatePromptMessage] = useState<string | null>(null);
  const [createPromptError, setCreatePromptError] = useState<string | null>(null);
  const [isDeletingPromptId, setIsDeletingPromptId] = useState<string | null>(null);
  const [deletePromptError, setDeletePromptError] = useState<string | null>(null);
  const metricWindowDays = summary?.windowDays ?? DEFAULT_WINDOW_DAYS;

  const stats = [
    {
      label: "Prompts Count",
      value: formatWholeNumber(summary?.metrics.promptsCount.value),
      sub: formatDelta(summary?.metrics.promptsCount.deltaPct, metricWindowDays),
    },
    {
      label: "Optimize Count",
      value: formatWholeNumber(summary?.metrics.optimizeCount.value),
      sub: formatDelta(summary?.metrics.optimizeCount.deltaPct, metricWindowDays),
    },
    {
      label: "Compliance Pass Rate",
      value: formatPercentage(summary?.metrics.compliancePassRate.value),
      sub: formatDelta(summary?.metrics.compliancePassRate.deltaPct, metricWindowDays),
    },
    {
      label: "Model Cost",
      value: formatCurrency(summary?.metrics.modelCostUsd.value),
      sub: formatDelta(summary?.metrics.modelCostUsd.deltaPct, metricWindowDays),
    },
  ];

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
      await Promise.all([refetch(), refetchSummary()]);
    } catch (err: unknown) {
      setCreateError(getApiErrorMessage(err, "Failed to create project"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreatePrompt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedProjectId) {
      setCreatePromptError("Select a project first");
      setCreatePromptMessage(null);
      return;
    }

    const title = newPromptTitle.trim();
    const rawPrompt = newPromptRawPrompt.trim();

    if (!title) {
      setCreatePromptError("Prompt title is required");
      setCreatePromptMessage(null);
      return;
    }

    setIsCreatingPrompt(true);
    setCreatePromptError(null);
    setCreatePromptMessage(null);

    try {
      const createdPrompt = await apiPost<Prompt>("/api/prompts", {
        projectId: selectedProjectId,
        title,
        rawPrompt: rawPrompt || "You are a helpful assistant.",
      });

      setNewPromptTitle("");
      setNewPromptRawPrompt("");
      setCreatePromptMessage("Prompt created");
      await Promise.all([refetchPrompts(), refetchSummary()]);
      onSelectPrompt(createdPrompt.id);
    } catch (err: unknown) {
      setCreatePromptError(getApiErrorMessage(err, "Failed to create prompt"));
    } finally {
      setIsCreatingPrompt(false);
    }
  };

  const handleDeletePrompt = async (promptId: string, promptTitle: string) => {
    const shouldDelete = window.confirm(`Delete prompt "${promptTitle}"?`);
    if (!shouldDelete) {
      return;
    }

    setIsDeletingPromptId(promptId);
    setDeletePromptError(null);

    try {
      await apiDelete<{ id: string }>(`/api/prompts/${encodeURIComponent(promptId)}`);
      if (selectedPromptId === promptId) {
        onSelectPrompt(null);
      }
      await Promise.all([refetchPrompts(), refetchSummary()]);
    } catch (err: unknown) {
      setDeletePromptError(getApiErrorMessage(err, "Failed to delete prompt"));
    } finally {
      setIsDeletingPromptId(null);
    }
  };

  return (
    <section className="panel">
      <h2>Dashboard</h2>
      <div className="stats-grid">
        {stats.map((stat) => (
          <article className="stat" key={stat.label}>
            <p>{stat.label}</p>
            <h3>{stat.value}</h3>
            <span>{stat.sub}</span>
          </article>
        ))}
      </div>
      {isSummaryLoading ? <p className="muted">{LOADING_TEXT}</p> : null}
      {summaryError ? <p className="muted">{summaryError}</p> : null}

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
        {createMessage ? <p className="muted">{createMessage}</p> : null}
        {createError ? <p className="muted">{createError}</p> : null}
        {isLoading ? (
          <p className="muted">{LOADING_TEXT}</p>
        ) : error ? (
          <p className="muted">{error}</p>
        ) : !projects || projects.length === 0 ? (
          <p className="muted">{EMPTY_PROJECTS_TEXT}</p>
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
        ) : (
          <>
            <form onSubmit={handleCreatePrompt} style={{ marginBottom: "12px" }}>
              <input
                type="text"
                value={newPromptTitle}
                onChange={(e) => setNewPromptTitle(e.target.value)}
                placeholder="New prompt title"
                style={{
                  width: "100%",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "10px",
                  marginBottom: "8px",
                }}
              />
              <textarea
                rows={4}
                value={newPromptRawPrompt}
                onChange={(e) => setNewPromptRawPrompt(e.target.value)}
                placeholder="Prompt content (optional)"
              />
              <button type="submit" className="btn primary" disabled={isCreatingPrompt}>
                {isCreatingPrompt ? "Creating..." : "Create Prompt"}
              </button>
            </form>

            {createPromptMessage ? <p className="muted">{createPromptMessage}</p> : null}
            {createPromptError ? <p className="muted">{createPromptError}</p> : null}
            {deletePromptError ? <p className="muted">{deletePromptError}</p> : null}

            {isPromptsLoading ? (
              <p className="muted">{LOADING_TEXT}</p>
            ) : promptsError ? (
              <p className="muted">{promptsError}</p>
            ) : !prompts || prompts.length === 0 ? (
              <p className="muted">{EMPTY_PROMPTS_TEXT}</p>
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
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => handleDeletePrompt(prompt.id, prompt.title)}
                          disabled={isDeletingPromptId === prompt.id}
                          style={{ marginLeft: "8px" }}
                        >
                          {isDeletingPromptId === prompt.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </section>
  );
}
