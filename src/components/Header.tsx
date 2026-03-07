"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

type HeaderProps = {
  onCreatePrompt?: () => void;
  isCreatingPrompt?: boolean;
  createPromptMessage?: string | null;
  createPromptError?: string | null;
};

export function Header({
  onCreatePrompt,
  isCreatingPrompt = false,
  createPromptMessage = null,
  createPromptError = null,
}: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <h1>GenPromptly</h1>
        <p>Prompt operations platform by OpsForLocal</p>
      </div>
      <div className="topbar-actions-wrap">
        <div className="topbar-actions">
          <SignedIn>
            <Link href="/app" className="btn ghost" style={{ textDecoration: "none" }}>
              Workspace
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="redirect">
              <button type="button" className="btn ghost">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button type="button" className="btn ghost">
                Create Account
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <div style={{ display: "inline-flex", alignItems: "center" }}>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <button
            type="button"
            className="btn primary"
            onClick={onCreatePrompt}
            disabled={isCreatingPrompt}
          >
            {isCreatingPrompt ? "Creating..." : "Create Prompt"}
          </button>
        </div>
        {createPromptError ? <p className="muted topbar-status">{createPromptError}</p> : null}
        {!createPromptError && createPromptMessage ? (
          <p className="muted topbar-status">{createPromptMessage}</p>
        ) : null}
      </div>
    </header>
  );
}
