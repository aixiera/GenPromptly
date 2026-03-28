"use client";

import { useEffect } from "react";
import { setActiveOrg } from "../lib/apiClient";

type OrgContextSyncProps = {
  orgId: string;
};

export function OrgContextSync({ orgId }: OrgContextSyncProps) {
  useEffect(() => {
    setActiveOrg(orgId);
  }, [orgId]);

  return null;
}
