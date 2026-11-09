import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
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
export function formatAuditChanges(entry: Pick<AuditLogDto, 'changesJson' | 'changes'>): string | null {
  let value: unknown = entry.changes;
  if (value === undefined || value === null) {
    if (!entry.changesJson) return null;
    try {
      value = JSON.parse(entry.changesJson);
    } catch {
      return entry.changesJson;
    }
  }
  return JSON.stringify(redact(value), null, 2);
}
