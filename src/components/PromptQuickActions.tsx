"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiDownload, apiPost, getApiErrorMessage, triggerBrowserDownload } from "../lib/apiClient";

type PromptQuickActionsProps = {
  promptId: string;
};

export function PromptQuickActions({ promptId }: PromptQuickActionsProps) {
  const router = useRouter();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setError(null);
    try {
      await apiPost(`/api/prompts/${encodeURIComponent(promptId)}/optimize`, {
        mode: "workflow",
        skillKey: "workflow_spec",
      });
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to optimize prompt"));
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const { blob, filename } = await apiDownload(`/api/prompts/${encodeURIComponent(promptId)}/export`);
      triggerBrowserDownload(blob, filename ?? `prompt-${promptId}.json`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to export prompt"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="btn ghost" onClick={handleOptimize} disabled={isOptimizing}>
        {isOptimizing ? "Optimizing..." : "Optimize Prompt"}
      </button>
      <button type="button" className="btn ghost" onClick={() => { void handleExport(); }} disabled={isExporting}>
        {isExporting ? "Exporting..." : "Export Prompt"}
      </button>
      {error ? <span className="muted">{error}</span> : null}
    </div>
  );
}
