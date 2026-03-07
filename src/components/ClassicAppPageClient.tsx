"use client";

import { useMemo, useState } from "react";
import { Header } from "./Header";
import { Sidebar, type AppPage } from "./Sidebar";
import { AppFooter } from "./AppFooter";
import { apiGet, apiPost, getApiErrorMessage } from "../lib/apiClient";
import { Compliance } from "../pages/Compliance";
import { Dashboard } from "../pages/Dashboard";
import { ModelCompare } from "../pages/ModelCompare";
import { PromptEditor } from "../pages/PromptEditor";
import { Team } from "../pages/Team";
import { Templates } from "../pages/Templates";
import { useComplianceReport } from "../lib/hooks/useComplianceReport";
import type { Project, Prompt } from "../lib/types";

const DEFAULT_PROJECT_NAME = "New Project";
const DEFAULT_PROMPT_TITLE = "Untitled Prompt";
const DEFAULT_PROMPT_CONTENT = "You are a helpful assistant.";

export default function ClassicAppPage() {
  const [activePage, setActivePage] = useState<AppPage>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingPromptFromHeader, setIsCreatingPromptFromHeader] = useState(false);
  const [createPromptHeaderMessage, setCreatePromptHeaderMessage] = useState<string | null>(null);
  const [createPromptHeaderError, setCreatePromptHeaderError] = useState<string | null>(null);
  const complianceData = useComplianceReport(activePage === "compliance");

  const handleCreatePromptFromHeader = async () => {
    setIsCreatingPromptFromHeader(true);
    setCreatePromptHeaderError(null);
    setCreatePromptHeaderMessage(null);

    try {
      let targetProjectId = selectedProjectId;

      if (!targetProjectId) {
        const projects = await apiGet<Project[]>("/api/projects");
        if (projects.length > 0) {
          targetProjectId = projects[0].id;
        } else {
          const createdProject = await apiPost<Project>("/api/projects", {
            name: DEFAULT_PROJECT_NAME,
          });
          targetProjectId = createdProject.id;
        }
      }

      const createdPrompt = await apiPost<Prompt>("/api/prompts", {
        projectId: targetProjectId,
        title: DEFAULT_PROMPT_TITLE,
        rawPrompt: DEFAULT_PROMPT_CONTENT,
      });

      setSelectedProjectId(targetProjectId);
      setSelectedPromptId(createdPrompt.id);
      setActivePage("editor");
      setCreatePromptHeaderMessage("Prompt created and opened in editor.");
    } catch (err: unknown) {
      setCreatePromptHeaderError(
        getApiErrorMessage(err, "Failed to create prompt. Try selecting a project and retry.")
      );
    } finally {
      setIsCreatingPromptFromHeader(false);
    }
  };

  const pageContent = useMemo(() => {
    if (activePage === "dashboard") {
      return (
        <Dashboard
          selectedProjectId={selectedProjectId}
          selectedPromptId={selectedPromptId}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            setSelectedPromptId(null);
          }}
          onSelectPrompt={(promptId) => {
            setSelectedPromptId(promptId);
            if (promptId) {
              setActivePage("editor");
            }
          }}
        />
      );
    }
    if (activePage === "editor") {
      return (
        <PromptEditor
          promptId={selectedPromptId}
          selectedProjectId={selectedProjectId}
          selectedTemplateId={selectedTemplateId}
          onOpenPrompt={(promptId) => {
            setSelectedPromptId(promptId);
            setActivePage("editor");
          }}
        />
      );
    }
    if (activePage === "templates") {
      return (
        <Templates
          onSelectTemplate={(templateId) => {
            setSelectedTemplateId(templateId);
            setSelectedPromptId(null);
            setActivePage("editor");
          }}
        />
      );
    }
    if (activePage === "team") {
      return <Team />;
    }
    if (activePage === "compliance") {
      return (
        <>
          <Compliance
            report={complianceData.report}
            orgSlug={complianceData.orgSlug}
            isLoading={complianceData.isLoading}
            error={complianceData.error}
            onRetry={complianceData.refetch}
          />
          <ModelCompare
            report={complianceData.report}
            isLoading={complianceData.isLoading}
            error={complianceData.error}
          />
        </>
      );
    }
    return null;
  }, [activePage, complianceData, selectedProjectId, selectedPromptId, selectedTemplateId]);

  return (
    <main className="app-shell classic-app">
      <Sidebar active={activePage} onChange={setActivePage} />
      <section className="content-wrap">
        <Header
          onCreatePrompt={() => {
            void handleCreatePromptFromHeader();
          }}
          isCreatingPrompt={isCreatingPromptFromHeader}
          createPromptMessage={createPromptHeaderMessage}
          createPromptError={createPromptHeaderError}
        />
        {pageContent}
        <AppFooter />
      </section>
    </main>
  );
}
