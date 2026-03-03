"use client";

import { useCallback, useEffect, useState } from "react";
import { ComplianceBadge } from "../components/ComplianceBadge";
import { VariablePanel } from "../components/VariablePanel";
import { apiPatch, apiPost, getApiErrorMessage } from "../lib/apiClient";
import { usePromptDetail } from "../lib/hooks/usePromptDetail";
import type { PromptVersion } from "../lib/types";

type PromptEditorProps = {
  promptId: string | null;
};

const LOADING_TEXT = "Loading data...";
const EMPTY_VERSIONS_TEXT = "No versions yet.";
const EMPTY_RESULT_TEXT = "No optimized result yet.";

export function PromptEditor({ promptId }: PromptEditorProps) {
  const { data, isLoading, error, refetch } = usePromptDetail(promptId);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftRawPrompt, setDraftRawPrompt] = useState("");
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [optimizeMode, setOptimizeMode] = useState<
    "general" | "marketing" | "healthcare" | "finance" | "legal"
  >("general");
  const [optimizeGoal, setOptimizeGoal] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [copyPromptFeedback, setCopyPromptFeedback] = useState<string | null>(null);
  const [copyJsonFeedback, setCopyJsonFeedback] = useState<string | null>(null);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

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
  }, [data?.id, data?.title, data?.rawPrompt, data?.versions]);

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
        <h2>Prompt Editor(Three Columns)</h2>
        <p className="muted">Select a prompt to edit.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel">
        <h2>Prompt Editor(Three Columns)</h2>
        <p className="muted">{LOADING_TEXT}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Prompt Editor(Three Columns)</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="panel">
        <h2>Prompt Editor(Three Columns)</h2>
        <p className="muted">No prompt data available.</p>
      </section>
    );
  }

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;

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
              {isSaving ? "Saving..." : "Save"}
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
          <h4>Optimized Prompt</h4>
          <select
            value={optimizeMode}
            onChange={(e) => setOptimizeMode(e.target.value as typeof optimizeMode)}
          >
            <option value="general">general</option>
            <option value="marketing">marketing</option>
            <option value="healthcare">healthcare</option>
            <option value="finance">finance</option>
            <option value="legal">legal</option>
          </select>
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
            {isOptimizing ? "Optimizing..." : "Optimize"}
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
          <div className="output-box">
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
              <div className="card-block" style={{ marginBottom: "10px" }}>
                <h4>Result Panel</h4>
                <p><strong>optimizedPrompt</strong></p>
                <p className="muted">{selectedVersion.optimizedPrompt}</p>
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
                  <h3>{selectedVersion.scores.clarity} / 100</h3>
                </div>
                <ul>
                  <li>Context: {selectedVersion.scores.context}</li>
                  <li>Constraints: {selectedVersion.scores.constraints}</li>
                  <li>Format: {selectedVersion.scores.format}</li>
                </ul>
              </div>
              <div className="badge-row">
                {selectedVersion.riskFlags.length === 0 ? (
                  <ComplianceBadge label="No Risk Flags" />
                ) : (
                  selectedVersion.riskFlags.map((flag) => <ComplianceBadge key={flag} label={flag} />)
                )}
              </div>
              <pre>{JSON.stringify(selectedVersion, null, 2)}</pre>
            </>
          ) : null}
        </article>
      </div>
    </section>
  );
}
