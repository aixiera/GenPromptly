"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { apiDelete, apiPatch, apiPost, getApiErrorMessage } from "../lib/apiClient";
import { PageHeader } from "./PageHeader";

type OrgRole = "OWNER" | "ADMIN" | "MEMBER";
type InviteStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

type MemberRow = {
  id: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

type InviteRow = {
  id: string;
  email: string;
  role: OrgRole;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

type TeamManagementPanelProps = {
  orgSlug: string;
  currentUserId: string;
  currentRole: OrgRole;
  members: MemberRow[];
  invites: InviteRow[];
  canInvite: boolean;
  canChangeRole: boolean;
  canRemoveMember: boolean;
};

type InviteCreateResponse = {
  id: string;
  email: string;
  role: OrgRole;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  inviteLink: string;
};

export function TeamManagementPanel({
  orgSlug,
  currentUserId,
  currentRole,
  members: initialMembers,
  invites: initialInvites,
  canInvite,
  canChangeRole,
  canRemoveMember,
}: TeamManagementPanelProps) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [invites, setInvites] = useState<InviteRow[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null);
  const [pendingRemoveUserId, setPendingRemoveUserId] = useState<string | null>(null);
  const [pendingRevokeInviteId, setPendingRevokeInviteId] = useState<string | null>(null);
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);
  const [latestInviteId, setLatestInviteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedInvites = useMemo(() => {
    return [...invites].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [invites]);

  const setFeedback = (nextMessage: string | null, nextError: string | null) => {
    setMessage(nextMessage);
    setError(nextError);
  };

  const handleCreateInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canInvite) {
      setFeedback(null, "Your role cannot invite members.");
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setFeedback(null, "Email is required.");
      return;
    }

    setIsInviting(true);
    setFeedback(null, null);
    setLatestInviteLink(null);
    try {
      const created = await apiPost<InviteCreateResponse>(
        `/api/orgs/${encodeURIComponent(orgSlug)}/invites`,
        {
          email: normalizedEmail,
          role: inviteRole,
          expiresInDays: 7,
        }
      );
      setInvites((prev) => [
        {
          id: created.id,
          email: created.email,
          role: created.role,
          status: created.status,
          createdAt: created.createdAt,
          expiresAt: created.expiresAt,
          acceptedAt: null,
          revokedAt: null,
        },
        ...prev.filter((entry) => entry.id !== created.id),
      ]);
      setEmail("");
      setLatestInviteLink(created.inviteLink);
      setLatestInviteId(created.id);
      setFeedback("Invite created.", null);
      router.refresh();
    } catch (err: unknown) {
      setFeedback(null, getApiErrorMessage(err, "Failed to create invite"));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, role: OrgRole) => {
    if (!canChangeRole) {
      setFeedback(null, "Your role cannot change member roles.");
      return;
    }
    setPendingRoleUserId(userId);
    setFeedback(null, null);
    try {
      await apiPatch(`/api/orgs/${encodeURIComponent(orgSlug)}/members`, { userId, role });
      setMembers((prev) =>
        prev.map((entry) => (entry.userId === userId ? { ...entry, role } : entry))
      );
      setFeedback("Role updated.", null);
      router.refresh();
    } catch (err: unknown) {
      setFeedback(null, getApiErrorMessage(err, "Failed to update role"));
    } finally {
      setPendingRoleUserId(null);
    }
  };

  const handleRemoveMember = async (userId: string, displayName: string) => {
    if (!canRemoveMember) {
      setFeedback(null, "Your role cannot remove members.");
      return;
    }
    const confirmed = window.confirm(`Remove ${displayName} from this workspace?`);
    if (!confirmed) {
      return;
    }

    setPendingRemoveUserId(userId);
    setFeedback(null, null);
    try {
      await apiDelete(`/api/orgs/${encodeURIComponent(orgSlug)}/members`, { userId });
      setMembers((prev) => prev.filter((entry) => entry.userId !== userId));
      setFeedback("Member removed.", null);
      router.refresh();
    } catch (err: unknown) {
      setFeedback(null, getApiErrorMessage(err, "Failed to remove member"));
    } finally {
      setPendingRemoveUserId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setPendingRevokeInviteId(inviteId);
    setFeedback(null, null);
    try {
      await apiDelete(`/api/orgs/${encodeURIComponent(orgSlug)}/invites/${encodeURIComponent(inviteId)}`);
      setInvites((prev) =>
        prev.map((entry) =>
          entry.id === inviteId
            ? { ...entry, status: "REVOKED", revokedAt: new Date().toISOString() }
            : entry
        )
      );
      setFeedback("Invite revoked.", null);
      router.refresh();
    } catch (err: unknown) {
      setFeedback(null, getApiErrorMessage(err, "Failed to revoke invite"));
    } finally {
      setPendingRevokeInviteId(null);
    }
  };

  const handleCopy = async (value: string, successLabel: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(successLabel, null);
    } catch {
      setFeedback(null, "Copy failed.");
    }
  };

  const visibleRoleOptions: OrgRole[] = currentRole === "OWNER" ? ["OWNER", "ADMIN", "MEMBER"] : ["MEMBER"];

  return (
    <section style={{ display: "grid", gap: "12px" }}>
      <section className="panel">
        <PageHeader
          title="Team"
          description="Invite members, assign roles, and manage workspace access with RBAC controls."
        />
        <p className="muted" style={{ marginBottom: "12px" }}>Your role: {currentRole}</p>
        <form onSubmit={handleCreateInvite} style={{ display: "grid", gap: "10px", maxWidth: "520px" }}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@company.com"
            disabled={!canInvite || isInviting}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "10px",
            }}
          />
          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as "ADMIN" | "MEMBER")}
            disabled={!canInvite || isInviting}
            style={{ maxWidth: "240px", marginBottom: 0 }}
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="btn primary" disabled={!canInvite || isInviting}>
              {isInviting ? "Inviting..." : "Invite Member"}
            </button>
            {!canInvite ? <span className="muted">Invite requires admin/owner permission.</span> : null}
          </div>
        </form>
        {latestInviteLink ? (
          <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span className="muted" style={{ overflowWrap: "anywhere" }}>
              Latest invite link: {latestInviteLink}
            </span>
            <button type="button" className="btn ghost" onClick={() => { void handleCopy(latestInviteLink, "Invite link copied."); }}>
              Copy Invite Link
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Members</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Active workspace members and role assignments.
        </p>
        {members.length === 0 ? (
          <div className="card-block">
            <p style={{ marginBottom: "6px" }}>No members found.</p>
            <p className="muted" style={{ margin: 0 }}>
              Invite teammates to collaborate in this workspace.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const canEditRow = canChangeRole && !isSelf;
                const canRemoveRow = canRemoveMember && !isSelf;
                const label = member.user.name || member.user.email;
                return (
                  <tr key={member.id}>
                    <td>{member.user.name ?? "Unknown"}</td>
                    <td>{member.user.email}</td>
                    <td>
                      <span className="badge" style={{ marginRight: "8px" }}>
                        {member.role}
                      </span>
                      {canEditRow ? (
                        <select
                          value={member.role}
                          onChange={(event) => {
                            void handleRoleChange(member.userId, event.target.value as OrgRole);
                          }}
                          disabled={pendingRoleUserId === member.userId}
                          style={{ width: "auto", marginBottom: 0 }}
                        >
                          {visibleRoleOptions.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleOption}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </td>
                    <td>{new Date(member.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => {
                          void handleRemoveMember(member.userId, label);
                        }}
                        disabled={!canRemoveRow || pendingRemoveUserId === member.userId}
                        title={
                          isSelf
                            ? "You cannot remove yourself from this screen."
                            : !canRemoveMember
                              ? "Remove requires admin/owner permission."
                              : undefined
                        }
                      >
                        {pendingRemoveUserId === member.userId ? "Removing..." : "Remove"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginBottom: "6px" }}>Invites</h2>
        <p className="muted" style={{ marginBottom: "10px" }}>
          Pending and historical invitations for this workspace.
        </p>
        {sortedInvites.length === 0 ? (
          <div className="card-block">
            <p style={{ marginBottom: "6px" }}>No invites sent yet.</p>
            <p className="muted" style={{ margin: 0 }}>
              Invite history will appear here with status and expiry details.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedInvites.map((invite) => {
                const pendingAndNotExpired =
                  invite.status === "PENDING" && new Date(invite.expiresAt).getTime() > Date.now();
                const displayStatus =
                  invite.status === "PENDING" && !pendingAndNotExpired ? "EXPIRED" : invite.status;
                return (
                  <tr key={invite.id}>
                    <td>{invite.email}</td>
                    <td>{invite.role}</td>
                    <td>
                      <span className="badge">{displayStatus}</span>
                    </td>
                    <td>{new Date(invite.createdAt).toLocaleString()}</td>
                    <td>{new Date(invite.expiresAt).toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={!latestInviteLink || latestInviteId !== invite.id}
                          title={
                            latestInviteId !== invite.id
                              ? "Only newly created invite links are available for copy."
                              : undefined
                          }
                          onClick={() => {
                            if (latestInviteLink && latestInviteId === invite.id) {
                              void handleCopy(latestInviteLink, "Invite link copied.");
                            }
                          }}
                        >
                          Copy Link
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          disabled
                          title="Resend email integration is not configured yet."
                        >
                          Resend (Coming Soon)
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            void handleRevokeInvite(invite.id);
                          }}
                          disabled={!pendingAndNotExpired || pendingRevokeInviteId === invite.id}
                          title={!pendingAndNotExpired ? "Only pending invites can be revoked." : undefined}
                        >
                          {pendingRevokeInviteId === invite.id ? "Revoking..." : "Revoke"}
                        </button>
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
      {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
    </section>
  );
}
