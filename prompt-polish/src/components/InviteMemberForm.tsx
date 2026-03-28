"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";

type InviteMemberFormProps = {
  orgSlug: string;
};

type InviteResponse = {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  inviteLink: string;
};

export function InviteMemberForm({ orgSlug }: InviteMemberFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setLatestInviteLink(null);

    try {
      const response = await apiPost<InviteResponse>(
        `/api/orgs/${encodeURIComponent(orgSlug)}/invites`,
        {
          email: normalizedEmail,
          role,
          expiresInDays: 7,
        }
      );
      setEmail("");
      setLatestInviteLink(response.inviteLink);
      router.refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to create invite"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px" }}>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="member@company.com"
        style={{
          border: "1px solid var(--line)",
          borderRadius: "10px",
          padding: "10px",
          width: "100%",
          maxWidth: "320px",
        }}
      />
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as "ADMIN" | "MEMBER")}
        style={{ maxWidth: "220px", marginBottom: 0 }}
      >
        <option value="MEMBER">Member</option>
        <option value="ADMIN">Admin</option>
      </select>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn primary" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Invite Member"}
        </button>
        {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
      </div>
      {latestInviteLink ? (
        <p className="muted" style={{ margin: 0, overflowWrap: "anywhere" }}>
          Invite link: <a href={latestInviteLink}>{latestInviteLink}</a>
        </p>
      ) : null}
    </form>
  );
}
