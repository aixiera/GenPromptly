import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../apiClient";
import type { Prompt, PromptVersion } from "../types";

type PromptDetail = Prompt & {
  versions: PromptVersion[];
};

type UsePromptDetailResult = {
  data: PromptDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function usePromptDetail(promptId: string | null | undefined): UsePromptDetailResult {
  const [data, setData] = useState<PromptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!promptId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiGet<PromptDetail>(`/api/prompts/${encodeURIComponent(promptId)}`);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch prompt details");
    } finally {
      setIsLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
