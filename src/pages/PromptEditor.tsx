"use client";

import { useCallback, useEffect, useState } from "react";
import { ComplianceBadge } from "../components/ComplianceBadge";
import { VariablePanel } from "../components/VariablePanel";
import { apiPatch, apiPost, getApiErrorMessage } from "../lib/apiClient";
import { usePromptDetail } from "../lib/hooks/usePromptDetail";
import type { Prompt, PromptVersion } from "../lib/types";

type PromptEditorProps = {
  promptId: string | null;
  selectedProjectId: string | null;
  selectedTemplateId?: string | null;
  onOpenPrompt: (promptId: string) => void;
};

const LOADING_TEXT = "Loading data...";
const EMPTY_VERSIONS_TEXT = "No versions yet.";
const EMPTY_RESULT_TEXT = "No optimized result yet.";

function normalizeScoreOutOfTen(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = value > 10 ? value / 10 : value;
  return Math.min(10, Math.max(0, normalized));
}

function formatScoreOutOfTen(value: number): string {
  return normalizeScoreOutOfTen(value).toFixed(1);
}

export function PromptEditor({
  promptId,
  selectedProjectId,
  selectedTemplateId,
  onOpenPrompt,
}: PromptEditorProps) {
  const { data, isLoading, error, refetch } = usePromptDetail(promptId);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftRawPrompt, setDraftRawPrompt] = useState("");
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [optimizeMode, setOptimizeMode] = useState<
    "workflow" | "marketing" | "compliance" | "email" | "video" | "image"
  >("workflow");
  const [optimizeGoal, setOptimizeGoal] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [copyPromptFeedback, setCopyPromptFeedback] = useState<string | null>(null);
  const [copyJsonFeedback, setCopyJsonFeedback] = useState<string | null>(null);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);
  const [createFromTemplateError, setCreateFromTemplateError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      setDraftTitle("");
      setDraftRawPrompt("");
      setVersions([]);
      return;
    }

    setDraftTitle(data.title);
    setDraftRawPrompt(data.rawPrompt);
    setVersions(data.versions);
  }, [data]);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedVersionId(null);
      return;
    }

    if (!selectedVersionId || !versions.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

  const hasUnsavedChanges =
    !!data && (draftTitle !== data.title || draftRawPrompt !== data.rawPrompt);

  const handleCreatePromptFromTemplate = async () => {
    if (!selectedTemplateId) {
      return;
    }

    if (!selectedProjectId) {
      setCreateFromTemplateError("Select a project in Projects first.");
      return;
    }

    setIsCreatingFromTemplate(true);
    setCreateFromTemplateError(null);

    try {
      const createdPrompt = await apiPost<Prompt>("/api/prompts", {
        projectId: selectedProjectId,
        title: "Untitled Template Prompt",
        rawPrompt: "",
        templateId: selectedTemplateId,
      });

      onOpenPrompt(createdPrompt.id);
    } catch (err: unknown) {
      setCreateFromTemplateError(getApiErrorMessage(err, "Failed to create prompt from template"));
    } finally {
      setIsCreatingFromTemplate(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!data || !hasUnsavedChanges) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      await apiPatch(`/api/prompts/${encodeURIComponent(data.id)}`, {
        title: draftTitle,
        rawPrompt: draftRawPrompt,
      });
      setSaveMessage("Draft saved");
      await refetch();
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err, "Failed to save draft"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOptimize = useCallback(async () => {
    if (!data || !data.id) {
      return;
    }

    setIsOptimizing(true);
    setOptimizeError(null);

    try {
      const createdVersion = await apiPost<PromptVersion>(
        `/api/prompts/${encodeURIComponent(data.id)}/optimize`,
        {
          mode: optimizeMode,
          goal: optimizeGoal.trim() || undefined,
        }
      );

      setVersions((prev) => [createdVersion, ...prev.filter((v) => v.id !== createdVersion.id)]);
      setSelectedVersionId(createdVersion.id);
    } catch (err: unknown) {
      setOptimizeError(getApiErrorMessage(err, "Failed to optimize prompt"));
    } finally {
      setIsOptimizing(false);
    }
  }, [data, optimizeGoal, optimizeMode]);

  const handleCopyOptimizedPrompt = async () => {
    const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;
    if (!selectedVersion) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedVersion.optimizedPrompt);
      setCopyPromptFeedback("Copied!");
      setTimeout(() => setCopyPromptFeedback(null), 1500);
    } catch {
      setCopyPromptFeedback("Copy failed");
      setTimeout(() => setCopyPromptFeedback(null), 1500);
    }
  };

  const handleCopyJson = async () => {
    const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;
    if (!selectedVersion) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedVersion, null, 2));
      setCopyJsonFeedback("Copied!");
      setTimeout(() => setCopyJsonFeedback(null), 1500);
    } catch {
      setCopyJsonFeedback("Copy failed");
      setTimeout(() => setCopyJsonFeedback(null), 1500);
    }
  };

  const handleRestoreVersion = async () => {
    if (!data) {
      return;
    }

    const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;
    if (!selectedVersion) {
      return;
    }

    const shouldRestore = window.confirm("Restore this version into the prompt editor?");
    if (!shouldRestore) {
      return;
    }

    setIsRestoringVersion(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      await apiPatch(`/api/prompts/${encodeURIComponent(data.id)}`, {
        title: draftTitle,
        rawPrompt: selectedVersion.optimizedPrompt,
      });
      setDraftRawPrompt(selectedVersion.optimizedPrompt);
      setSaveMessage("Version restored");
      await refetch();
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err, "Failed to restore version"));
    } finally {
      setIsRestoringVersion(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      void handleOptimize();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleOptimize]);

  if (!promptId) {
    return (
      <section className="panel">
        <h2>Prompt Workflow Editor</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Select a prompt to edit, or open a workflow from Tools.
        </p>
        {selectedTemplateId ? (
          <button
            type="button"
            className="btn primary"
            onClick={handleCreatePromptFromTemplate}
            disabled={isCreatingFromTemplate}
            style={{ marginBottom: "10px" }}
          >
            {isCreatingFromTemplate ? "Creating..." : "Open Workflow"}
          </button>
        ) : null}
        {createFromTemplateError ? <p className="muted">{createFromTemplateError}</p> : null}
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel">
        <h2>Prompt Workflow Editor</h2>
        <p className="muted">{LOADING_TEXT}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Prompt Workflow Editor</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="panel">
        <h2>Prompt Workflow Editor</h2>
        <p className="muted">No prompt data available.</p>
      </section>
    );
  }

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;
  const displayedScores = selectedVersion
    ? {
        clarity: formatScoreOutOfTen(selectedVersion.scores.clarity),
        context: formatScoreOutOfTen(selectedVersion.scores.context),
        constraints: formatScoreOutOfTen(selectedVersion.scores.constraints),
        format: formatScoreOutOfTen(selectedVersion.scores.format),
      }
    : null;

  return (
    <section className="panel">
      <h2>Prompt Workflow Editor</h2>
      <div className="editor-grid">
        <article className="editor-col">
          <h4>Workflow Setup</h4>
          <p className="muted" style={{ marginBottom: "8px" }}>
            Selected tool templates and variables for this workflow.
          </p>
          {selectedTemplateId ? (
            <button
              type="button"
              className="btn primary"
              onClick={handleCreatePromptFromTemplate}
              disabled={isCreatingFromTemplate}
              style={{ marginBottom: "10px" }}
            >
              {isCreatingFromTemplate ? "Creating..." : "Open Workflow"}
            </button>
          ) : null}
          {createFromTemplateError ? <p className="muted">{createFromTemplateError}</p> : null}
          <p className="muted" style={{ marginBottom: "10px" }}>
            Use the Tools page to choose one of the six core workflows.
          </p>
          <VariablePanel />
        </article>

        <article className="editor-col">
          <div className="row-between">
            <h4>Prompt Editor</h4>
            <span>
              {selectedVersion ? `Version ${selectedVersion.id.slice(0, 8)}` : EMPTY_VERSIONS_TEXT}
            </span>
          </div>
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => {
              setDraftTitle(e.target.value);
              setSaveMessage(null);
              setSaveError(null);
            }}
            placeholder="Prompt title"
            style={{
              width: "100%",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "10px",
              marginBottom: "10px",
            }}
          />
          <textarea
            rows={14}
            value={draftRawPrompt}
            onChange={(e) => {
              setDraftRawPrompt(e.target.value);
              setSaveMessage(null);
              setSaveError(null);
            }}
          />
          <div className="row-between">
            <p className="muted">Character count: {draftRawPrompt.length}</p>
            <button
              type="button"
              className="btn primary"
              onClick={handleSaveDraft}
              disabled={!hasUnsavedChanges || isSaving}
            >
              {isSaving ? "Saving..." : "Save Draft"}
            </button>
          </div>
          {hasUnsavedChanges ? <p className="muted">Unsaved changes</p> : null}
          {saveMessage ? <p className="muted">{saveMessage}</p> : null}
          {saveError ? <p className="muted">{saveError}</p> : null}
          <div className="diff-box">
            {versions.length === 0 ? (
              <p className="muted">{EMPTY_VERSIONS_TEXT}</p>
            ) : (
              versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  className="btn ghost"
                  onClick={() => setSelectedVersionId(version.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    marginBottom: "8px",
                    borderColor:
                      selectedVersionId === version.id ? "var(--focus-ring)" : "var(--line)",
                  }}
                >
                  <strong>{version.id.slice(0, 8)}</strong>{" "}
                  {new Date(version.createdAt).toLocaleString()} | {version.mode} | {version.model}
                </button>
              ))
            )}
          </div>
        </article>

        <article className="editor-col">
          <h4>Result Panel</h4>
          <label style={{ display: "grid", gap: "4px" }}>
            <span className="muted">Optimization Skill</span>
          <select
            value={optimizeMode}
            onChange={(e) => setOptimizeMode(e.target.value as typeof optimizeMode)}
          >
            <option value="workflow">Workflow Spec</option>
            <option value="marketing">Marketing Variants</option>
            <option value="compliance">Compliance Review</option>
            <option value="email">Email Pack</option>
            <option value="video">Video Script</option>
            <option value="image">Image To Prompt</option>
          </select>
          </label>
          <input
            type="text"
            value={optimizeGoal}
            onChange={(e) => setOptimizeGoal(e.target.value)}
            placeholder="Optional optimization goal"
            style={{
              width: "100%",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "10px",
              marginBottom: "10px",
            }}
          />
          <button
            type="button"
            className="btn primary"
            onClick={handleOptimize}
            disabled={isOptimizing}
            style={{ marginBottom: "10px" }}
          >
            {isOptimizing ? "Optimizing..." : "Optimize Prompt"}
          </button>
          <p className="muted" style={{ marginTop: "-2px", marginBottom: "10px" }}>
            Shortcut: Ctrl/Cmd + Enter
          </p>
          {optimizeError ? (
            <div style={{ marginBottom: "10px" }}>
              <p className="muted">{optimizeError}</p>
              <button type="button" className="btn ghost" onClick={handleOptimize} disabled={isOptimizing}>
                Retry
              </button>
            </div>
          ) : null}
          <div className="output-box result-output">
            {selectedVersion ? selectedVersion.optimizedPrompt : EMPTY_RESULT_TEXT}
          </div>
          {selectedVersion ? (
            <>
              <div className="row-between" style={{ marginBottom: "10px" }}>
                <button type="button" className="btn ghost" onClick={handleCopyOptimizedPrompt}>
                  Copy optimized prompt
                </button>
                <button type="button" className="btn ghost" onClick={handleCopyJson}>
                  Copy JSON
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleRestoreVersion}
                  disabled={isRestoringVersion}
                >
                  {isRestoringVersion ? "Restoring..." : "Restore this version"}
                </button>
              </div>
              {copyPromptFeedback ? <p className="muted">{copyPromptFeedback}</p> : null}
              {copyJsonFeedback ? <p className="muted">{copyJsonFeedback}</p> : null}
              <div className="card-block result-panel" style={{ marginBottom: "10px" }}>
                <h4>Structured Result</h4>
                <p><strong>optimizedPrompt</strong></p>
                <p className="muted result-wrap-text">{selectedVersion.optimizedPrompt}</p>
                <p><strong>keyChanges</strong></p>
                <ul>
                  {selectedVersion.keyChanges.length === 0 ? (
                    <li>None</li>
                  ) : (
                    selectedVersion.keyChanges.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)
                  )}
                </ul>
                <p><strong>missingFields</strong></p>
                <ul>
                  {selectedVersion.missingFields.length === 0 ? (
                    <li>None</li>
                  ) : (
                    selectedVersion.missingFields.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)
                  )}
                </ul>
                <p><strong>riskFlags</strong></p>
                <ul>
                  {selectedVersion.riskFlags.length === 0 ? (
                    <li>None</li>
                  ) : (
                    selectedVersion.riskFlags.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)
                  )}
                </ul>
              </div>
              <div className="score-card">
                <div>
                  <p>Clarity Score</p>
                  <h3>{displayedScores?.clarity} / 10</h3>
                </div>
                <ul>
                  <li>Context: {displayedScores?.context} / 10</li>
                  <li>Constraints: {displayedScores?.constraints} / 10</li>
                  <li>Format: {displayedScores?.format} / 10</li>
                </ul>
              </div>
              <div className="badge-row">
                {selectedVersion.riskFlags.length === 0 ? (
                  <ComplianceBadge label="No Risk Flags" />
                ) : (
                  selectedVersion.riskFlags.map((flag) => <ComplianceBadge key={flag} label={flag} />)
                )}
              </div>
              <pre className="result-json">{JSON.stringify(selectedVersion, null, 2)}</pre>
            </>
          ) : null}
        </article>
      </div>
    </section>
  );
}

export default PromptEditor;
