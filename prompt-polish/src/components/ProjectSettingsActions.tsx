"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiDelete, apiPatch, getApiErrorMessage } from "../lib/apiClient";

type ProjectSettingsActionsProps = {
  projectId: string;
  orgSlug: string;
  initialName: string;
  canUpdate: boolean;
  canDelete: boolean;
};

export function ProjectSettingsActions({
  projectId,
  orgSlug,
  initialName,
  canUpdate,
  canDelete,
}: ProjectSettingsActionsProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpdate) {
      setError("Your role cannot rename this project.");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }

    setIsRenaming(true);
    setError(null);
    setMessage(null);
    try {
      await apiPatch(`/api/projects/${encodeURIComponent(projectId)}`, { name: trimmed });
      setMessage("Project name updated.");
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to rename project"));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      setError("Your role cannot delete this project.");
      return;
    }
    const confirmed = window.confirm("Delete this project and its prompts?");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await apiDelete(`/api/projects/${encodeURIComponent(projectId)}`);
      router.push(`/app/${encodeURIComponent(orgSlug)}/projects`);
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to delete project"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="panel">
      <h2 style={{ marginBottom: "6px" }}>Project Settings</h2>
      <p className="muted" style={{ marginBottom: "10px" }}>
        Rename or delete this project. Project-level actions follow workspace permissions.
      </p>
      <form onSubmit={handleRename} style={{ display: "grid", gap: "10px", marginBottom: "10px" }}>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canUpdate || isRenaming}
          style={{
            border: "1px solid var(--line)",
            borderRadius: "10px",
            padding: "10px",
            maxWidth: "420px",
          }}
        />
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="btn ghost" disabled={!canUpdate || isRenaming}>
            {isRenaming ? "Saving..." : "Save Changes"}
          </button>
          {!canUpdate ? <span className="muted">Only members with update access can rename.</span> : null}
        </div>
      </form>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn ghost"
          onClick={handleDelete}
          disabled={!canDelete || isDeleting}
          title={!canDelete ? "Only admins/owners can delete projects." : undefined}
        >
          {isDeleting ? "Deleting..." : "Delete Project"}
        </button>
        {!canDelete ? <span className="muted">Delete requires elevated role.</span> : null}
      </div>
      {message ? <p className="muted" style={{ marginTop: "8px" }}>{message}</p> : null}
      {error ? <p className="muted" style={{ marginTop: "8px" }}>{error}</p> : null}
    </section>
  );
}
