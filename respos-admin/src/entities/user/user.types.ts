import type { UserStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export interface UserDto {
  id: Guid;
  email: string;
  fullName: string;
  phone: string | null;
  status: UserStatus;
  roles: { id: Guid; code: string; name: string }[];
  branches: { id: Guid; name: string }[];
  lastLoginAt: Iso8601 | null;
}

export interface UserListParams extends PageParams {
  status?: UserStatus;
  roleId?: string;
  branchId?: string;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  roleIds: string[];
  branchIds: string[];
}

export interface InviteUserInput {
  email: string;
  fullName: string;
  roleIds: string[];
  branchIds: string[];
}

export interface InvitationResult {
  invitationId: Guid;
  /** Shown to the admin in MVP (email provider is a stub). */
  inviteLink: string;
}

export interface UpdateUserInput {
  fullName: string;
  phone?: string;
  roleIds: string[];
  branchIds: string[];
}

export type UserAction = 'block' | 'unblock' | 'deactivate';
