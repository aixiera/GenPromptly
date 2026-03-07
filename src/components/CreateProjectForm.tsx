"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await apiPost("/api/projects", { name: trimmed });
      setName("");
      setMessage("Project created.");
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to create project."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}
    >
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New project"
        style={{
          border: "1px solid var(--line)",
          borderRadius: "10px",
          padding: "10px",
          minWidth: "240px",
        }}
      />
      <button type="submit" className="btn primary" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Project"}
      </button>
      {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
      {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
    </form>
  );
}
