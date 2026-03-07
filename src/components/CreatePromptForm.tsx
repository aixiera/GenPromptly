"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";
import type { Prompt } from "../lib/types";

type CreatePromptFormProps = {
  projectId: string;
  orgSlug?: string;
};

export function CreatePromptForm({ projectId, orgSlug }: CreatePromptFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [rawPrompt, setRawPrompt] = useState("You are a helpful assistant.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Prompt title is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await apiPost<Prompt>("/api/prompts", {
        projectId,
        title: trimmedTitle,
        rawPrompt: rawPrompt.trim() || "You are a helpful assistant.",
      });
      setTitle("");
      setRawPrompt("You are a helpful assistant.");
      if (orgSlug) {
        router.push(`/app/${encodeURIComponent(orgSlug)}/prompts/${encodeURIComponent(created.id)}`);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to create prompt."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px" }}>
      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Prompt title"
        style={{
          border: "1px solid var(--line)",
          borderRadius: "10px",
          padding: "10px",
          width: "100%",
        }}
      />
      <textarea
        rows={4}
        value={rawPrompt}
        onChange={(event) => setRawPrompt(event.target.value)}
        style={{ marginBottom: 0 }}
      />
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Prompt"}
        </button>
        {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
      </div>
    </form>
  );
}
