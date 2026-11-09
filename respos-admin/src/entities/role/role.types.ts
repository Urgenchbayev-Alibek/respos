import type { Guid } from '@/shared/types/api-response';

export interface RoleDto {
  id: Guid;
  code: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface PermissionDto {
  code: string;
  module: string;
  description: string;
}

export interface RoleInput {
  name: string;
  permissions: string[];
}
