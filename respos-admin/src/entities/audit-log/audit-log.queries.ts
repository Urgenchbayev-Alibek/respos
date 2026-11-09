import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import { zonedToUtcIso } from '@/shared/lib/zoned-time';
import type { PagedResult } from '@/shared/types/pagination';
import type { AuditLogDto, AuditLogListParams } from './audit-log.types';

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  list: (params: AuditLogListParams) => [...auditLogKeys.all, 'list', params] as const,
};

export function useAuditLogs(params: AuditLogListParams) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: ({ signal }) =>
      apiClient.get<PagedResult<AuditLogDto>>(ENDPOINTS.auditLogs, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

const SECRET_KEY = /pass(word)?|token|secret|hash|card|cvv|pin/i;
const REDACTED = '***';

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, SECRET_KEY.test(key) ? REDACTED : redact(inner)]),
    );
  }
  return value;
}

/**
 * Pretty JSON of the audit changes. The server already sanitizes; this is defence in depth so that a
 * secret-looking key is never rendered even if a backend bug lets it through.
 */
export function formatAuditChanges(entry: Pick<AuditLogDto, 'changes'>): string | null {
  if (entry.changes === undefined || entry.changes === null) return null;
  return JSON.stringify(redact(entry.changes), null, 2);
}

const END_OF_DAY_MS = 59_999;

/**
 * `<input type="date">` values → inclusive UTC instants for `from`/`to` (the API compares `createdAt` with
 * instants, so a bare `YYYY-MM-DD` would mean midnight UTC and drop the whole `to` day).
 */
export function auditDateRange(from: string, to: string, timeZone?: string): { from?: string; to?: string } {
  const start = from ? zonedToUtcIso(from, '00:00', timeZone) : '';
  const endMinute = to ? zonedToUtcIso(to, '23:59', timeZone) : '';
  return {
    from: start || undefined,
    to: endMinute ? new Date(new Date(endMinute).getTime() + END_OF_DAY_MS).toISOString() : undefined,
  };
}
