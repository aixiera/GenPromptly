import { useCallback, useEffect, useState } from "react";
import type { ComplianceReport } from "../compliance/types";
import { apiGet, getApiErrorMessage } from "../apiClient";

type AuthMembership = {
  orgId: string;
  orgSlug: string;
};

type AuthContextPayload = {
  user: {
    lastActiveOrgId: string | null;
  };
  memberships: AuthMembership[];
};

type UseComplianceReportResult = {
  report: ComplianceReport | null;
  orgSlug: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

function resolveOrgSlug(payload: AuthContextPayload): string | null {
  const activeOrgId = payload.user.lastActiveOrgId?.trim() || null;
  if (activeOrgId) {
    const activeMembership = payload.memberships.find((entry) => entry.orgId === activeOrgId) ?? null;
    if (activeMembership?.orgSlug?.trim()) {
      return activeMembership.orgSlug.trim();
    }
  }

  const fallback = payload.memberships[0]?.orgSlug?.trim();
  return fallback || null;
}

export function useComplianceReport(enabled = true): UseComplianceReportResult {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const auth = await apiGet<AuthContextPayload>("/api/orgs");
      const resolvedOrgSlug = resolveOrgSlug(auth);
      if (!resolvedOrgSlug) {
        throw new Error("No workspace selected");
      }

      const compliance = await apiGet<ComplianceReport>(
        `/api/orgs/${encodeURIComponent(resolvedOrgSlug)}/compliance`
      );

      setOrgSlug(resolvedOrgSlug);
      setReport(compliance);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to load compliance data"));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refetch();
  }, [enabled, refetch]);

  return { report, orgSlug, isLoading, error, refetch };
}
