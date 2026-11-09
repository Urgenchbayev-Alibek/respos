import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/** `GET /audit-logs` item. `changesJson` is already sanitized by the server (no passwords/tokens). */
export interface AuditLogDto {
  id: Guid;
  createdAt: Iso8601;
  userId: Guid | null;
  userName?: string | null;
  branchId?: Guid | null;
  branchName?: string | null;
  organizationId?: Guid | null;
  organizationName?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  correlationId: string | null;
  ipAddress?: string | null;
  changesJson?: string | null;
  changes?: unknown;
}

export interface AuditLogListParams extends PageParams {
  from?: string;
  to?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}
