import type { Language } from '@/shared/constants/locale';

/** RFC 7807 ProblemDetails + RestaurantOS extensions (CONVENTIONS.md "Error format"). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
}

export type Iso8601 = string;
export type Guid = string;

/** MeDto from CONVENTIONS.md "Auth flow". */
export interface MeDto {
  id: Guid;
  email: string;
  fullName: string;
  preferredLanguage: Language;
  isPlatformAdmin: boolean;
  currentOrganization: { id: Guid; name: string; currency: string; defaultLanguage: Language } | null;
  organizations: { id: Guid; name: string }[];
  roles: string[];
  permissions: string[];
  branches: { id: Guid; name: string; timezone: string }[];
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: Iso8601;
  user: MeDto;
}
