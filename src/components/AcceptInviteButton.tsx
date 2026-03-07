"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";

type AcceptInviteButtonProps = {
  token: string;
};

type AcceptInviteResponse = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  membershipId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

export function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<AcceptInviteResponse>("/api/invites/accept", { token });
      router.push(`/app/${encodeURIComponent(result.orgSlug)}/dashboard`);
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to accept invite"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "8px", marginTop: "14px" }}>
      <button type="button" className="btn primary" onClick={handleAccept} disabled={isSubmitting}>
        {isSubmitting ? "Accepting..." : "Accept Invite"}
      </button>
      {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
    </div>
  );
}
