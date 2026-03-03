"use client";

import { useMemo, useState } from "react";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { Compliance } from "../pages/Compliance";
import { Dashboard } from "../pages/Dashboard";
import { ModelCompare } from "../pages/ModelCompare";
import { PromptEditor } from "../pages/PromptEditor";
import { Team } from "../pages/Team";
import { Templates } from "../pages/Templates";

export type AppPage = "dashboard" | "editor" | "templates" | "team" | "compliance";

export default function Home() {
  const [activePage, setActivePage] = useState<AppPage>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

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
            setActivePage("editor");
          }}
        />
      );
    }
    if (activePage === "editor") return <PromptEditor />;
    if (activePage === "templates") return <Templates />;
    if (activePage === "team") return <Team />;
    if (activePage === "compliance") {
      return (
        <>
          <Compliance />
          <ModelCompare />
        </>
      );
    }
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
          setActivePage("editor");
        }}
      />
    );
  }, [activePage, selectedProjectId, selectedPromptId]);

  return (
      <main className="app-shell">
      <Sidebar active={activePage} onChange={setActivePage} />
      <section className="content-wrap">
        <Header />
        {pageContent}
      </section>
    </main>
  );
}
