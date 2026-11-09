import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './api-error';

const NO_RETRY_STATUSES = new Set([400, 401, 403, 404, 409, 422]);
const MAX_RETRIES = 2;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && NO_RETRY_STATUSES.has(error.status)) return false;
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}
