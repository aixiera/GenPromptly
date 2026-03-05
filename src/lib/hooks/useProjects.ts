import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../apiClient";
import type { Project } from "../types";

type UseProjectsResult = {
  data: Project[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useProjects(): UseProjectsResult {
  const [data, setData] = useState<Project[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiGet<Project[]>("/api/projects");
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
