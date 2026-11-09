import { env } from '@/shared/config/env';

/** RFC 7807 ProblemDetails as described in respos-contracts/CONVENTIONS.md. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;

  constructor(status: number, problem: ProblemDetails | null) {
    super(problem?.title ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

/** Thrown when the request never reached the server (offline, CORS, DNS). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed', { cause });
    this.name = 'NetworkError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  language?: string;
}

const parseProblem = async (response: Response): Promise<ProblemDetails | null> => {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('json')) return null;
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return null;
  }
};

const isAbort = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.language) headers['Accept-Language'] = options.language;

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new NetworkError(error);
  }

  if (!response.ok) throw new ApiError(response.status, await parseProblem(response));

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
