"use client";

import { useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";

type BillingAction = "checkout" | "portal";

type BillingActionButtonProps = {
  action: BillingAction;
  label: string;
  pendingLabel?: string;
  className?: string;
};

type BillingActionResponse = {
  url: string;
};

export function BillingActionButton({
  action,
  label,
  pendingLabel,
  className = "btn primary",
}: BillingActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = action === "checkout" ? "/api/billing/checkout" : "/api/billing/portal";
  const fallbackMessage =
    action === "checkout"
      ? "Unable to start checkout right now. Please try again."
      : "Unable to open billing portal right now. Please try again.";

  const runAction = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiPost<BillingActionResponse>(endpoint, {});
      if (!result.url) {
        throw new Error("Billing action did not return a redirect URL.");
      }
      window.location.assign(result.url);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, fallbackMessage));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <button
        type="button"
        className={className}
        onClick={() => {
          void runAction();
        }}
        disabled={isLoading}
      >
        {isLoading ? pendingLabel ?? "Redirecting..." : label}
      </button>
      {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
    </div>
  );
}
