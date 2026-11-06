import type { ApiError } from "./types";

// Only reads use this policy. A failed write may already have succeeded and
// must never be replayed automatically.
export function retryRead(failureCount: number, error: unknown): boolean {
  const status = (error as Partial<ApiError> | null)?.status;
  return (
    failureCount < 2 &&
    (status === 0 ||
      status === 408 ||
      status === 429 ||
      (typeof status === "number" && status >= 500))
  );
}

export const readRetryDelay = (attempt: number) =>
  Math.min(2000 * 2 ** attempt, 10000);
