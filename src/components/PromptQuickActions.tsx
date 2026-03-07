"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";

type PromptQuickActionsProps = {
  promptId: string;
};

export function PromptQuickActions({ promptId }: PromptQuickActionsProps) {
  const router = useRouter();
  const [isOptimizing, setIsOptimizing] = useState(false);
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

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="btn ghost" onClick={handleOptimize} disabled={isOptimizing}>
        {isOptimizing ? "Optimizing..." : "Optimize Prompt"}
      </button>
      <a className="btn ghost" href={`/api/prompts/${encodeURIComponent(promptId)}/export`}>
        Export Prompt
      </a>
      {error ? <span className="muted">{error}</span> : null}
    </div>
  );
}
