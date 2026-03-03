import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../apiClient";
import type { Prompt } from "../types";

type UsePromptsResult = {
  data: Prompt[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function usePrompts(projectId: string | null | undefined): UsePromptsResult {
  const [data, setData] = useState<Prompt[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!projectId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiGet<Prompt[]>(
        `/api/projects/${encodeURIComponent(projectId)}/prompts`
      );
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch prompts");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
