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
        <h1>Prompt Generator App</h1>
        <p>Vertical Product | Legally Priorized | Auditable Prompt Engineering Platform</p>
      </div>
      <div className="topbar-actions-wrap">
        <div className="topbar-actions">
          <button className="btn ghost">Invite Team</button>
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
