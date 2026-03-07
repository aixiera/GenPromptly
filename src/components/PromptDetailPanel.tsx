"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ApiRequestError,
  apiDelete,
  apiDownload,
  apiPatch,
  apiPost,
  getApiErrorMessage,
  triggerBrowserDownload,
} from "../lib/apiClient";
import type { PromptVersion } from "../lib/types";
import {
  DEFAULT_SKILL_KEY,
  getSkillByTemplateKey,
  getSkillDefinition,
  listSkillDefinitions,
  resolveSkillDefinition,
  type SkillKey,
  type ToolWorkflow,
} from "../lib/tools/toolRegistry";

type PromptDetailPanelProps = {
  orgSlug: string;
  prompt: {
    id: string;
    projectId: string;
    title: string;
    rawPrompt: string;
    createdAt: string;
    updatedAt: string;
    versions: PromptVersion[];
  };
  projectName: string;
  templateName: string | null;
  templateKey: string | null;
  initialSkillKey: string | null;
  canUpdate: boolean;
  canDelete: boolean;
  canOptimize: boolean;
  canExport: boolean;
};

function scoreLabel(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function hasObjectEntries(value: Record<string, unknown> | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function resolveVersionSkill(version: PromptVersion, templateKey: string | null): ToolWorkflow | null {
  return resolveSkillDefinition({
    skillKey: version.skillKey ?? null,
    toolKey: version.toolKey ?? null,
    profile: version.workflowProfile ?? version.mode,
    templateKey,
  });
}

function renderStringList(title: string, values: string[]) {
  return (
    <div className="card-block" style={{ marginTop: "8px" }}>
      <p style={{ marginBottom: "6px" }}><strong>{title}</strong></p>
      {values.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No data returned.</p>
      ) : (
        <ul style={{ marginBottom: 0 }}>
          {values.map((value, index) => (
            <li key={`${title}-${value}-${index}`}>{value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderSkillSpecificResult(skill: ToolWorkflow, version: PromptVersion) {
  const structured = toRecord(version.structuredData);

  if (skill.skillKey === "compliance_review") {
    const summary = toNullableString(structured.summary);
    const findings = Array.isArray(structured.findings) ? structured.findings : [];
    const recommendations = toStringArray(structured.recommendations);
    const riskSignals = toStringArray(structured.riskSignals);

    return (
      <>
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>Risk Summary</strong></p>
          <p className="muted" style={{ margin: 0 }}>{summary ?? "No summary returned."}</p>
        </div>
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>Top Findings</strong></p>
          {findings.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No findings returned.</p>
          ) : (
            <ul style={{ marginBottom: 0 }}>
              {findings.map((entry, index) => {
                const row = toRecord(entry);
                return (
                  <li key={`finding-${index}`}>
                    <strong>{toNullableString(row.severity)?.toUpperCase() ?? "UNKNOWN"}</strong>:{" "}
                    {toNullableString(row.issue) ?? "No issue description"}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {renderStringList("Recommendations", recommendations.length ? recommendations : version.recommendations ?? [])}
        {renderStringList("Risk Signals", riskSignals.length ? riskSignals : version.riskFlags)}
      </>
    );
  }

  if (skill.skillKey === "image_to_prompt") {
    return (
      <>
        {renderStringList("Additions Made", toStringArray(structured.additionsMade))}
        {renderStringList("Style Notes", toStringArray(structured.styleNotes))}
        {renderStringList("Composition Notes", toStringArray(structured.compositionNotes))}
        {renderStringList("Negative Prompt Suggestions", toStringArray(structured.negativePromptSuggestions))}
      </>
    );
  }

  if (skill.skillKey === "video_script") {
    const hook = toNullableString(structured.hook);
    const ctaNotes = toNullableString(structured.ctaNotes);
    const outline = Array.isArray(structured.structureOutline) ? structured.structureOutline : [];
    return (
      <>
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>Hook</strong></p>
          <p className="muted" style={{ margin: 0 }}>{hook ?? "No hook returned."}</p>
        </div>
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>Structure Outline</strong></p>
          {outline.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No structure outline returned.</p>
          ) : (
            <ul style={{ marginBottom: 0 }}>
              {outline.map((entry, index) => {
                const row = toRecord(entry);
                return (
                  <li key={`outline-${index}`}>
                    <strong>{toNullableString(row.segment) ?? "Segment"}</strong> ({toNullableString(row.timing) ?? "timing not set"}):{" "}
                    {toNullableString(row.purpose) ?? "purpose not set"}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>CTA Notes</strong></p>
          <p className="muted" style={{ margin: 0 }}>{ctaNotes ?? "No CTA notes returned."}</p>
        </div>
        {renderStringList("Pacing Improvements", toStringArray(structured.pacingNotes))}
      </>
    );
  }

  if (skill.skillKey === "marketing_variants") {
    const basePrompt = toNullableString(structured.baseImprovedPrompt);
    const variants = Array.isArray(structured.variants) ? structured.variants : [];
    return (
      <>
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>Primary Improved Version</strong></p>
          <div className="output-box result-output">{basePrompt ?? version.optimizedPrompt}</div>
        </div>
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>Variant Angles</strong></p>
          {variants.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No variants returned.</p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {variants.map((entry, index) => {
                const row = toRecord(entry);
                return (
                  <article key={`variant-${index}`} className="card-block" style={{ marginBottom: 0 }}>
                    <p style={{ marginBottom: "4px" }}>
                      <strong>{toNullableString(row.angle) ?? `Variant ${index + 1}`}</strong>
                    </p>
                    <p className="muted" style={{ marginBottom: "4px" }}>
                      {toNullableString(row.notes) ?? "No notes provided."}
                    </p>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      Best use case: {toNullableString(row.bestUseCase) ?? "Not specified"}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  if (skill.skillKey === "email_pack") {
    return (
      <>
        {renderStringList("Subject Line Hints", toStringArray(structured.subjectLineHints))}
        {renderStringList("Structure Suggestions", toStringArray(structured.structureSuggestions))}
        {renderStringList("Tone Guidance", toStringArray(structured.toneGuidance))}
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>CTA Guidance</strong></p>
          <p className="muted" style={{ margin: 0 }}>{toNullableString(structured.ctaGuidance) ?? "No CTA guidance returned."}</p>
        </div>
      </>
    );
  }

  if (skill.skillKey === "workflow_spec") {
    const workflowStructure = Array.isArray(structured.workflowStructure) ? structured.workflowStructure : [];
    return (
      <>
        <div className="card-block" style={{ marginTop: "8px" }}>
          <p style={{ marginBottom: "6px" }}><strong>Workflow Structure</strong></p>
          {workflowStructure.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No workflow structure returned.</p>
          ) : (
            <ul style={{ marginBottom: 0 }}>
              {workflowStructure.map((entry, index) => {
                const row = toRecord(entry);
                return (
                  <li key={`workflow-step-${index}`}>
                    <strong>{toNullableString(row.step) ?? `Step ${index + 1}`}</strong>:{" "}
                    {toNullableString(row.purpose) ?? "No purpose specified"}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {renderStringList("Required Inputs", toStringArray(structured.requiredInputs))}
        {renderStringList("Expected Outputs", toStringArray(structured.expectedOutputs))}
        {renderStringList("Constraints Added", toStringArray(structured.constraintsAdded))}
      </>
    );
  }

  return null;
}

export function PromptDetailPanel({
  orgSlug,
  prompt,
  projectName,
  templateName,
  templateKey,
  initialSkillKey,
  canUpdate,
  canDelete,
  canOptimize,
  canExport,
}: PromptDetailPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState(prompt.title);
  const [rawPrompt, setRawPrompt] = useState(prompt.rawPrompt);
  const [versions, setVersions] = useState<PromptVersion[]>(prompt.versions);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [optimizeGoal, setOptimizeGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const allSkills = useMemo(() => listSkillDefinitions(), []);
  const templateSkill = useMemo(() => getSkillByTemplateKey(templateKey), [templateKey]);
  const latestVersion = useMemo(() => versions[0] ?? null, [versions]);

  const inferredSkill = useMemo(() => {
    if (templateSkill) {
      return templateSkill;
    }
    if (latestVersion) {
      const versionSkill = resolveVersionSkill(latestVersion, templateKey);
      if (versionSkill) {
        return versionSkill;
      }
    }
    return resolveSkillDefinition({
      skillKey: initialSkillKey,
      routeKey: initialSkillKey,
    }) ?? getSkillDefinition(DEFAULT_SKILL_KEY);
  }, [templateKey, templateSkill, latestVersion, initialSkillKey]);

  const [selectedSkillKey, setSelectedSkillKey] = useState<SkillKey>(
    (inferredSkill?.skillKey ?? DEFAULT_SKILL_KEY) as SkillKey
  );

  useEffect(() => {
    if (templateSkill && templateSkill.skillKey !== selectedSkillKey) {
      setSelectedSkillKey(templateSkill.skillKey);
      return;
    }
    if (!templateSkill && inferredSkill && inferredSkill.skillKey !== selectedSkillKey) {
      setSelectedSkillKey(inferredSkill.skillKey);
    }
  }, [inferredSkill, selectedSkillKey, templateSkill]);

  const selectedSkill = getSkillDefinition(selectedSkillKey) ?? getSkillDefinition(DEFAULT_SKILL_KEY);
  if (!selectedSkill) {
    throw new Error("Skill registry is not configured correctly.");
  }

  useEffect(() => {
    const currentSkillParam = searchParams?.get("skill");
    if (currentSkillParam === selectedSkill.skillKey) {
      return;
    }
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("skill", selectedSkill.skillKey);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedSkill.skillKey]);

  const latestVersionSkill = latestVersion ? resolveVersionSkill(latestVersion, templateKey) : null;
  const latestResultSkill = latestVersionSkill ?? selectedSkill;
  const hasChanges = title.trim() !== prompt.title || rawPrompt.trim() !== prompt.rawPrompt;

  const handleSave = async () => {
    if (!canUpdate) {
      setError("Your role cannot edit this prompt.");
      return;
    }
    if (!title.trim()) {
      setError("Prompt title is required.");
      return;
    }
    if (!rawPrompt.trim()) {
      setError("Prompt text cannot be empty.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiPatch(`/api/prompts/${encodeURIComponent(prompt.id)}`, {
        title: title.trim(),
        rawPrompt: rawPrompt.trim(),
      });
      setMessage("Draft saved.");
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to save prompt"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOptimize = async () => {
    if (!canOptimize) {
      setError("Your role cannot run optimize.");
      return;
    }

    setIsOptimizing(true);
    setError(null);
    setMessage(null);
    setUpgradeRequired(false);
    try {
      const createdVersion = await apiPost<PromptVersion>(
        `/api/prompts/${encodeURIComponent(prompt.id)}/optimize`,
        {
          mode: selectedSkill.defaultOptimizationProfile,
          skillKey: selectedSkill.skillKey,
          goal: optimizeGoal.trim() || undefined,
        }
      );
      setVersions((prev) => [createdVersion, ...prev.filter((entry) => entry.id !== createdVersion.id)]);
      setMessage("Prompt optimized. Review the latest result and version history.");
      setUpgradeRequired(false);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.code === "UPGRADE_REQUIRED") {
        setUpgradeRequired(true);
        setError(err.message);
      } else {
        setUpgradeRequired(false);
        setError(getApiErrorMessage(err, "Failed to optimize prompt"));
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      setError("Your role cannot delete this prompt.");
      return;
    }
    const confirmed = window.confirm(`Delete prompt "${prompt.title}"?`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await apiDelete(`/api/prompts/${encodeURIComponent(prompt.id)}`);
      router.push(`/app/${encodeURIComponent(orgSlug)}/prompts`);
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to delete prompt"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    if (!canExport) {
      setError("Your role cannot export prompts.");
      return;
    }

    setIsExporting(true);
    setError(null);
    setMessage(null);
    try {
      const { blob, filename } = await apiDownload(`/api/prompts/${encodeURIComponent(prompt.id)}/export`);
      triggerBrowserDownload(blob, filename ?? `prompt-${prompt.id}.json`);
      setMessage("Prompt export started.");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to export prompt"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <section className="panel">
        <div className="row-between" style={{ marginBottom: "8px", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ marginBottom: "6px" }}>{selectedSkill.editorTitle}</h2>
            <p className="muted" style={{ margin: 0 }}>
              Workflow: {selectedSkill.displayName} | Project: {projectName} | Template: {templateName ?? "None"}
            </p>
            <div className="badge-row" style={{ marginTop: "8px", marginBottom: 0 }}>
              <span className="badge">Selected Skill: {selectedSkill.displayName}</span>
              <span className="badge">Optimize Behavior: {selectedSkill.defaultOptimizationProfile}</span>
              {latestVersionSkill ? <span className="badge">Latest Run Skill: {latestVersionSkill.displayName}</span> : null}
            </div>
            <p className="muted" style={{ margin: "6px 0 0 0" }}>
              {selectedSkill.helperText}
            </p>
            <p className="muted" style={{ margin: "4px 0 0 0" }}>
              Updated: {new Date(prompt.updatedAt).toLocaleString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link href={`/app/${encodeURIComponent(orgSlug)}/prompts`} className="btn ghost" style={{ textDecoration: "none" }}>
              View Prompt List
            </Link>
            <Link
              href={`/app/${encodeURIComponent(orgSlug)}/audit?action=OPTIMIZE_PROMPT`}
              className="btn ghost"
              style={{ textDecoration: "none" }}
            >
              Open Audit Log
            </Link>
            {canExport ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  void handleExport();
                }}
                disabled={isExporting}
              >
                {isExporting ? "Exporting..." : "Export Prompt"}
              </button>
            ) : (
              <button type="button" className="btn ghost" disabled title="Your role cannot export prompts.">
                Export Prompt
              </button>
            )}
            <button
              type="button"
              className="btn ghost"
              onClick={handleDelete}
              disabled={!canDelete || isDeleting}
              title={!canDelete ? "Only admins/owners can delete prompts." : undefined}
            >
              {isDeleting ? "Deleting..." : "Delete Prompt"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "10px" }}>Prompt Workflow Workspace</h2>
        <div className="editor-grid">
          <article className="editor-col">
            <h3 style={{ marginBottom: "8px" }}>Workflow Setup</h3>
            <p className="muted" style={{ marginBottom: "8px" }}>
              The selected skill controls optimize behavior and output structure.
            </p>
            <label style={{ display: "grid", gap: "4px", marginBottom: "8px" }}>
              <span className="muted">Selected Skill</span>
              {templateSkill ? (
                <input
                  value={templateSkill.displayName}
                  disabled
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    padding: "10px",
                  }}
                />
              ) : (
                <select
                  value={selectedSkill.skillKey}
                  onChange={(event) => setSelectedSkillKey(event.target.value as SkillKey)}
                  style={{ marginBottom: 0 }}
                >
                  {allSkills.map((skill) => (
                    <option key={skill.skillKey} value={skill.skillKey}>
                      {skill.displayName}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label style={{ display: "grid", gap: "4px", marginBottom: "8px" }}>
              <span className="muted">Optimization Goal (optional)</span>
              <input
                type="text"
                value={optimizeGoal}
                onChange={(event) => setOptimizeGoal(event.target.value)}
                placeholder={selectedSkill.goalPlaceholder}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "10px",
                }}
              />
            </label>

            <div className="card-block" style={{ marginBottom: "8px" }}>
              <p style={{ marginBottom: "6px" }}>
                <strong>Recommended Setup</strong>
              </p>
              <ul style={{ marginBottom: 0 }}>
                {selectedSkill.promptHints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="chip-list" style={{ marginTop: "8px" }}>
                {Object.entries(selectedSkill.defaultVariables).map(([key, value]) => (
                  <span key={key} className="chip">
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn primary"
              onClick={() => {
                void handleOptimize();
              }}
              disabled={!canOptimize || isOptimizing}
            >
              {isOptimizing ? "Optimizing..." : selectedSkill.optimizeLabel}
            </button>
            {!canOptimize ? <p className="muted" style={{ marginTop: "8px", marginBottom: 0 }}>Optimize requires optimize permission.</p> : null}
          </article>

          <article className="editor-col">
            <h3 style={{ marginBottom: "8px" }}>Source Prompt</h3>
            <p className="muted" style={{ marginBottom: "8px" }}>
              Edit source content and save before running optimization.
            </p>
            <label style={{ display: "grid", gap: "4px", marginBottom: "8px" }}>
              <span className="muted">Prompt Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!canUpdate || isSaving}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "10px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "4px", marginBottom: "8px" }}>
              <span className="muted">{selectedSkill.defaultInputLabel}</span>
              <textarea
                rows={12}
                value={rawPrompt}
                onChange={(event) => setRawPrompt(event.target.value)}
                placeholder={selectedSkill.defaultPlaceholder}
              />
            </label>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={!canUpdate || !hasChanges || isSaving}
                >
                  {isSaving ? "Saving..." : "Save Draft"}
                </button>
            {!canUpdate ? <p className="muted" style={{ marginTop: "8px", marginBottom: 0 }}>Edit access requires update permission.</p> : null}
          </article>

          <article className="editor-col">
            <h3 style={{ marginBottom: "8px" }}>{latestResultSkill.resultTitle}</h3>
            {latestVersion ? (
              <>
                <p className="muted" style={{ marginBottom: "8px" }}>
                  Latest run: {new Date(latestVersion.createdAt).toLocaleString()}
                </p>
                <div className="output-box result-output">
                  {latestVersion.optimizedPrompt}
                </div>
                <div className="badge-row" style={{ marginBottom: "8px" }}>
                  <span className="badge">Skill: {latestResultSkill.displayName}</span>
                  <span className="badge">Model: {latestVersion.model}</span>
                  <span className="badge">Risk Flags: {latestVersion.riskFlags.length}</span>
                </div>
                <div className="score-card">
                  <p style={{ marginBottom: "6px" }}><strong>Scores</strong></p>
                  <p className="muted" style={{ marginBottom: "4px" }}>Clarity: {scoreLabel(latestVersion.scores.clarity)}</p>
                  <p className="muted" style={{ marginBottom: "4px" }}>Context: {scoreLabel(latestVersion.scores.context)}</p>
                  <p className="muted" style={{ marginBottom: "4px" }}>Constraints: {scoreLabel(latestVersion.scores.constraints)}</p>
                  <p className="muted" style={{ marginBottom: 0 }}>Format: {scoreLabel(latestVersion.scores.format)}</p>
                </div>
                <div className="card-block" style={{ marginTop: "8px" }}>
                  <p style={{ marginBottom: "6px" }}><strong>Key Changes</strong></p>
                  {latestVersion.keyChanges.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>No key changes reported.</p>
                  ) : (
                    <ul style={{ marginBottom: 0 }}>
                      {latestVersion.keyChanges.map((change, index) => (
                        <li key={`${change}-${index}`}>{change}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {renderSkillSpecificResult(latestResultSkill, latestVersion)}
                {hasObjectEntries(latestVersion.structuredData) ? (
                  <details style={{ marginTop: "8px" }}>
                    <summary className="muted" style={{ cursor: "pointer" }}>
                      Structured Data (Raw)
                    </summary>
                    <pre style={{ marginTop: "8px", maxHeight: "220px", overflow: "auto" }}>
                      {JSON.stringify(latestVersion.structuredData, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </>
            ) : (
              <div className="card-block">
                <p style={{ marginBottom: "6px" }}>No optimized versions yet.</p>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {selectedSkill.emptyStateText}
                </p>
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="panel">
        <h2>Version History</h2>
        {versions.length === 0 ? (
          <div className="card-block">
            <p style={{ marginBottom: "6px" }}>No versions yet.</p>
            <p className="muted" style={{ margin: 0 }}>
              Run optimize to generate the first prompt version and review changes.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Skill</th>
                <th>Model</th>
                <th>Recommendations</th>
                <th>Risk Flags</th>
                <th>Missing Fields</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => {
                const versionSkill = resolveVersionSkill(version, templateKey);
                return (
                  <tr key={version.id}>
                    <td>{new Date(version.createdAt).toLocaleString()}</td>
                    <td>{versionSkill?.displayName ?? version.skillKey ?? version.mode}</td>
                    <td>{version.model}</td>
                    <td>{version.recommendations?.length ?? 0}</td>
                    <td>{version.riskFlags.length}</td>
                    <td>{version.missingFields.length}</td>
                    <td>
                      <div className="muted" style={{ maxWidth: "360px" }}>
                        {version.optimizedPrompt.slice(0, 180)}
                        {version.optimizedPrompt.length > 180 ? "..." : ""}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
      {upgradeRequired ? (
        <div className="card-block">
          <p style={{ marginBottom: "6px" }}>
            Free optimization quota is exhausted. Upgrade to continue optimizing prompts.
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link href="/pricing" className="btn primary" style={{ textDecoration: "none" }}>
              Upgrade to Plus
            </Link>
            <Link
              href={`/app/${encodeURIComponent(orgSlug)}/billing`}
              className="btn ghost"
              style={{ textDecoration: "none" }}
            >
              Open Billing
            </Link>
          </div>
        </div>
      ) : null}
      {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
    </section>
  );
}
