"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";
import {
  DEFAULT_SKILL_KEY,
  getSkillDefinition,
  listSkillDefinitions,
  type SkillKey,
} from "../lib/tools/toolRegistry";

type PromptCreateFlowProps = {
  orgSlug: string;
  projects: Array<{ id: string; name: string }>;
  templates: Array<{ id: string; name: string; key: string; category: string }>;
  initialProjectId: string | null;
  initialTemplateId: string | null;
  initialSkillKey: string | null;
  templateLocked: boolean;
  contextWarning?: string | null;
};

type CreatedPrompt = {
  id: string;
};

function resolveInitialSkillKey(initialSkillKey: string | null): SkillKey {
  const selected = getSkillDefinition(initialSkillKey);
  return (selected?.skillKey ?? DEFAULT_SKILL_KEY) as SkillKey;
}

export function PromptCreateFlow({
  orgSlug,
  projects,
  templates,
  initialProjectId,
  initialTemplateId,
  initialSkillKey,
  templateLocked,
  contextWarning = null,
}: PromptCreateFlowProps) {
  const router = useRouter();
  const skills = useMemo(() => listSkillDefinitions(), []);
  const [skillKey, setSkillKey] = useState<SkillKey>(resolveInitialSkillKey(initialSkillKey));

  const skill = getSkillDefinition(skillKey) ?? getSkillDefinition(DEFAULT_SKILL_KEY);
  if (!skill) {
    throw new Error("Skill registry is not configured correctly.");
  }

  const resolvedTemplate = useMemo(() => {
    return templates.find((template) => template.key === skill.templateKey) ?? null;
  }, [templates, skill.templateKey]);

  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(
    initialTemplateId && templates.some((template) => template.id === initialTemplateId)
      ? initialTemplateId
      : resolvedTemplate?.id ?? ""
  );
  const [title, setTitle] = useState(skill.defaultTitle);
  const [rawPrompt, setRawPrompt] = useState(skill.defaultPrompt);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingAndOptimizing, setIsSavingAndOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLockTemplate = templateLocked && Boolean(resolvedTemplate);

  useEffect(() => {
    if (!canLockTemplate || !resolvedTemplate) {
      return;
    }
    if (templateId !== resolvedTemplate.id) {
      setTemplateId(resolvedTemplate.id);
    }
  }, [canLockTemplate, resolvedTemplate, templateId]);

  if (projects.length === 0) {
    return (
      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Create Prompt</h2>
        <p style={{ marginBottom: "8px" }}>No projects available yet.</p>
        <p className="muted" style={{ marginBottom: "12px" }}>
          Prompts are always scoped to a project. Create a project first, then return here.
        </p>
        <Link href={`/app/${encodeURIComponent(orgSlug)}/projects`} className="btn primary" style={{ textDecoration: "none" }}>
          Go to Projects
        </Link>
      </section>
    );
  }

  const validate = (): string | null => {
    if (!projectId) {
      return "Select a project.";
    }
    if (!templateId) {
      return "A template is required for skill workflows. Sync templates and retry.";
    }
    if (!title.trim()) {
      return "Prompt title is required.";
    }
    if (!rawPrompt.trim()) {
      return "Input content is required.";
    }
    return null;
  };

  const buildPromptDetailHref = (promptId: string, mode: "draft" | "optimized"): string => {
    const query = new URLSearchParams();
    if (mode === "draft") {
      query.set("saved", "draft");
    } else {
      query.set("optimized", "1");
    }
    query.set("skill", skill.skillKey);
    return `/app/${encodeURIComponent(orgSlug)}/prompts/${encodeURIComponent(promptId)}?${query.toString()}`;
  };

  const createPrompt = async (): Promise<CreatedPrompt> => {
    return apiPost<CreatedPrompt>("/api/prompts", {
      projectId,
      templateId,
      title: title.trim(),
      rawPrompt: rawPrompt.trim(),
    });
  };

  const handleSaveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSavingDraft(true);
    setError(null);
    try {
      const created = await createPrompt();
      router.push(buildPromptDetailHref(created.id, "draft"));
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to save draft"));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSaveAndOptimize = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSavingAndOptimizing(true);
    setError(null);
    try {
      const created = await createPrompt();
      await apiPost(`/api/prompts/${encodeURIComponent(created.id)}/optimize`, {
        mode: skill.defaultOptimizationProfile,
        skillKey: skill.skillKey,
      });
      router.push(buildPromptDetailHref(created.id, "optimized"));
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to create and optimize prompt"));
    } finally {
      setIsSavingAndOptimizing(false);
    }
  };

  const handleSkillChange = (nextSkillKey: string) => {
    const nextSkill = getSkillDefinition(nextSkillKey);
    if (!nextSkill) {
      return;
    }
    setSkillKey(nextSkill.skillKey);
    const nextTemplate = templates.find((template) => template.key === nextSkill.templateKey);
    setTemplateId(nextTemplate?.id ?? "");
    setTitle(nextSkill.defaultTitle);
    setRawPrompt(nextSkill.defaultPrompt);
  };

  return (
    <section className="panel">
      <h2 style={{ marginBottom: "6px" }}>{skill.editorTitle}</h2>
      <p className="muted" style={{ marginBottom: "10px" }}>
        {skill.editorSubtitle}
      </p>
      {contextWarning ? (
        <p className="muted" style={{ marginBottom: "10px" }}>
          {contextWarning}
        </p>
      ) : null}

      <div className="card-block" style={{ marginBottom: "10px" }}>
        <div className="badge-row" style={{ marginBottom: "8px" }}>
          <span className="badge">Selected Skill: {skill.displayName}</span>
          <span className="badge">Template: {skill.templateKey}</span>
          <span className="badge">Optimize: {skill.defaultOptimizationProfile}</span>
        </div>
        <p style={{ marginBottom: "6px" }}>
          <strong>{skill.workflowPurpose}</strong>
        </p>
        <ul style={{ marginBottom: 0 }}>
          {skill.promptHints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleSaveDraft} style={{ display: "grid", gap: "10px", maxWidth: "920px" }}>
        <label style={{ display: "grid", gap: "4px" }}>
          <span className="muted">Project</span>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} style={{ marginBottom: 0 }}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "4px" }}>
          <span className="muted">Selected Skill</span>
          {canLockTemplate ? (
            <input
              value={skill.displayName}
              disabled
              style={{
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "10px",
              }}
            />
          ) : (
            <select value={skill.skillKey} onChange={(event) => handleSkillChange(event.target.value)} style={{ marginBottom: 0 }}>
              {skills.map((entry) => (
                <option key={entry.skillKey} value={entry.skillKey}>
                  {entry.displayName}
                </option>
              ))}
            </select>
          )}
        </label>

        <label style={{ display: "grid", gap: "4px" }}>
          <span className="muted">Template</span>
          <input
            value={resolvedTemplate ? `${resolvedTemplate.name} (${resolvedTemplate.key})` : `${skill.templateKey} (missing)`}
            disabled
            style={{
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "10px",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "4px" }}>
          <span className="muted">Title</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={skill.defaultTitle}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "10px",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "4px" }}>
          <span className="muted">{skill.defaultInputLabel}</span>
          <textarea
            rows={9}
            value={rawPrompt}
            onChange={(event) => setRawPrompt(event.target.value)}
            placeholder={skill.defaultPlaceholder}
          />
        </label>
        <p className="input-safety-callout" style={{ marginTop: 0 }}>
          Please do not submit confidential, highly sensitive, or legally protected information unless necessary and
          authorized.
        </p>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="btn ghost" disabled={isSavingDraft || isSavingAndOptimizing}>
            {isSavingDraft ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              void handleSaveAndOptimize();
            }}
            disabled={isSavingDraft || isSavingAndOptimizing}
          >
            {isSavingAndOptimizing ? "Saving + Optimizing..." : skill.optimizeLabel}
          </button>
          <Link
            href={`/app/${encodeURIComponent(orgSlug)}/prompts`}
            className="btn ghost"
            style={{ textDecoration: "none" }}
          >
            Cancel
          </Link>
        </div>
        {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
      </form>
    </section>
  );
}
