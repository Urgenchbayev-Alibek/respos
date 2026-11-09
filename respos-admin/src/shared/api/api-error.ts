import type { ProblemDetails } from '@/shared/types/api-response';

export const NETWORK_ERROR_CODE = 'network.error';
export const UNKNOWN_ERROR_CODE = 'server.error';

/** Normalized error for every failed API call. `code` is the stable server code (e.g. `auth.invalid_credentials`). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string | undefined;
  readonly detail: string | undefined;
  readonly correlationId: string | undefined;
  /** Field errors keyed by camelCase field path (e.g. `email`, `items[0].quantity`). */
  readonly fieldErrors: Record<string, string[]>;

  constructor(init: {
    status: number;
    code: string;
    title?: string;
    detail?: string;
    correlationId?: string;
    fieldErrors?: Record<string, string[]>;
  }) {
    super(init.detail ?? init.title ?? init.code);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.correlationId = init.correlationId;
    this.fieldErrors = init.fieldErrors ?? {};
  }

  get isValidation(): boolean {
    return this.status === 400 && Object.keys(this.fieldErrors).length > 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** FluentValidation may send `Email` or `Items[0].Name`; the UI uses camelCase paths. */
export function normalizeFieldPath(path: string): string {
  return path
    .split('.')
    .map((part) => (part.length > 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part))
    .join('.');
}

function normalizeFieldErrors(errors: ProblemDetails['errors']): Record<string, string[]> {
  if (!errors || typeof errors !== 'object') return {};
  return Object.fromEntries(
    Object.entries(errors).map(([key, messages]) => [
      normalizeFieldPath(key),
      Array.isArray(messages) ? messages.map(String) : [String(messages)],
    ]),
  );
}

export function fallbackCodeForStatus(status: number): string {
  if (status === 0) return NETWORK_ERROR_CODE;
  if (status === 401) return 'auth.unauthenticated';
  if (status === 403) return 'auth.forbidden';
  if (status === 404) return 'resource.not_found';
  if (status === 429) return 'rate_limit.exceeded';
  if (status >= 500) return UNKNOWN_ERROR_CODE;
  return `http.${status}`;
}

/** Builds an ApiError from a non-OK response body (ProblemDetails JSON or anything else). */
export function apiErrorFromProblem(status: number, body: unknown, correlationHeader?: string | null): ApiError {
  const problem: ProblemDetails = body && typeof body === 'object' ? (body as ProblemDetails) : {};
  return new ApiError({
    status,
    code: problem.code ?? fallbackCodeForStatus(status),
    title: problem.title,
    detail: problem.detail,
    correlationId: problem.correlationId ?? correlationHeader ?? undefined,
    fieldErrors: normalizeFieldErrors(problem.errors),
  });
}

export function networkError(cause: unknown): ApiError {
  const error = new ApiError({ status: 0, code: NETWORK_ERROR_CODE, title: 'Network error' });
  if (cause instanceof Error) error.cause = cause;
  return error;
}
