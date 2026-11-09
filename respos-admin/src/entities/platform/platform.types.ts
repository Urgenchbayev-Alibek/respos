import type { AuditLogDto } from '@/entities/audit-log/audit-log.types';
import type { DemoRequestStatus, OrganizationStatus, SubscriptionStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/** Aggregates only — the platform never sees tenant business data here. */
export interface PlatformOrganizationDto {
  id: Guid;
  name: string;
  slug: string;
  status: OrganizationStatus;
  planCode: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  branchesCount: number;
  usersCount: number;
  createdAt: Iso8601;
  isDemo: boolean;
}

export interface PlatformOrganizationListParams extends PageParams {
  status?: OrganizationStatus;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  currency: string;
  ownerEmail: string;
  ownerFullName: string;
  ownerPassword: string;
  planCode: string;
  branchName: string;
}

export interface SubscriptionInput {
  planCode: string;
  status: SubscriptionStatus;
  endsAt?: string | null;
}

export interface PlanDto {
  id: Guid;
  code: string;
  name: string;
  maxBranches: number;
  maxUsers: number;
  isActive: boolean;
  features: string[];
}

export interface PlanInput {
  code: string;
  name: string;
  maxBranches: number;
  maxUsers: number;
  isActive: boolean;
  features: string[];
}

export interface FeatureDto {
  code: string;
  name: string;
}

export interface FeatureFlagDto {
  id: Guid;
  /** null = global default. */
  organizationId: Guid | null;
  featureCode: string;
  isEnabled: boolean;
  updatedAt: Iso8601 | null;
}

export interface SetFeatureFlagInput {
  organizationId: Guid | null;
  featureCode: string;
  isEnabled: boolean;
}

export interface SystemStatusDto {
  version: string;
  environment: string;
  /** `ok` or `unavailable` (DB check). */
  dbStatus: string;
  /** Seconds since process start. */
  uptime: number;
  startedAt: Iso8601;
  organizationsCount: number;
  usersCount: number;
  ordersToday: number;
}

/** `GET /platform/system-events` returns audit entries (`platform.*` and `integration.*` actions). */
export type SystemEventDto = AuditLogDto;

export interface DemoRequestDto {
  id: Guid;
  name: string;
  phone: string;
  email: string | null;
  restaurantName: string;
  city: string | null;
  message: string | null;
  status: DemoRequestStatus;
  createdAt: Iso8601;
}

export interface DemoRequestListParams extends PageParams {
  status?: DemoRequestStatus;
}

/** Break-glass: short-lived (30 min) read-only token for the organization. */
export interface TenantAccessDto {
  accessToken: string;
  expiresAt: Iso8601;
  organizationId: Guid;
  organizationName: string;
  /** Read-only org permissions granted for this session. */
  permissions: string[];
}
