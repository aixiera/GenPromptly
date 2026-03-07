"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";

type CreateOrgResponse = {
  orgId: string;
  orgSlug: string;
  orgName: string;
};

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Workspace name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await apiPost<CreateOrgResponse>("/api/orgs", { name: trimmed });
      router.push(`/app/${encodeURIComponent(created.orgSlug)}/dashboard`);
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to create workspace"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px", maxWidth: "420px" }}>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Workspace name"
        style={{
          border: "1px solid var(--line)",
          borderRadius: "10px",
          padding: "10px",
          width: "100%",
        }}
      />
      <button type="submit" className="btn primary" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Workspace"}
      </button>
      {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
    </form>
  );
}
