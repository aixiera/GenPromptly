"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost, getApiErrorMessage } from "../lib/apiClient";

export type OrgSwitcherOption = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

type OrgSwitcherProps = {
  currentOrgSlug: string;
  memberships: OrgSwitcherOption[];
  manageHref?: string;
  createHref?: string;
  showCreateLink?: boolean;
};

export function OrgSwitcher({
  currentOrgSlug,
  memberships,
  manageHref = "/app/select-org",
  createHref = "/app/select-org",
  showCreateLink = false,
}: OrgSwitcherProps) {
  const router = useRouter();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitch = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const orgSlug = event.target.value;
    if (!orgSlug || orgSlug === currentOrgSlug) {
      return;
    }

    setIsSwitching(true);
    setSwitchError(null);
    try {
      await apiPost("/api/orgs/switch", { orgSlug });
      router.push(`/app/${encodeURIComponent(orgSlug)}/dashboard`);
      router.refresh();
    } catch (err: unknown) {
      setSwitchError(getApiErrorMessage(err, "Failed to switch workspace"));
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
      <label htmlFor="org-switcher" className="muted" style={{ fontSize: "13px" }}>
        Workspace
      </label>
      <select
        id="org-switcher"
        value={currentOrgSlug}
        onChange={handleSwitch}
        disabled={isSwitching || memberships.length <= 1}
        style={{ minWidth: "220px", marginBottom: 0 }}
      >
        {memberships.map((entry) => (
          <option key={entry.orgId} value={entry.orgSlug}>
            {entry.orgName} ({entry.role})
          </option>
        ))}
      </select>
      <Link className="btn ghost" href={manageHref}>
        Switch Workspace
      </Link>
      {showCreateLink ? (
        <Link className="btn ghost" href={createHref}>
          Create Workspace
        </Link>
      ) : null}
      {switchError ? <p className="muted" style={{ margin: 0 }}>{switchError}</p> : null}
    </div>
  );
}
