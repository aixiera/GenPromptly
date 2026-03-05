import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../apiClient";
import type { DashboardSummary } from "../types";

type UseDashboardSummaryResult = {
  data: DashboardSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useDashboardSummary(): UseDashboardSummaryResult {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiGet<DashboardSummary>("/api/dashboard/summary");
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch dashboard summary");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
