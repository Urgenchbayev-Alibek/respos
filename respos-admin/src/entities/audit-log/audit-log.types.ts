import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/**
 * `GET /audit-logs` and `GET /platform/system-events` item (backend `AuditLogDto`).
 * `changes` is the sanitized JSON object (or null) — the server already strips passwords/tokens.
 */
export interface AuditLogDto {
  id: Guid;
  createdAt: Iso8601;
  organizationId: Guid | null;
  branchId: Guid | null;
  userId: Guid | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  changes: unknown;
}

/** `from`/`to` are UTC instants (ISO 8601), inclusive; prefix match on `action`. */
export interface AuditLogListParams extends PageParams {
  from?: string;
  to?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}
