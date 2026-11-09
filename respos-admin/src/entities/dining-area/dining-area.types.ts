import type { Guid } from '@/shared/types/api-response';

/** DiningArea (branch-scoped), respos-contracts/DOMAIN_MODEL.md "Floor & reservations". */
export interface DiningAreaDto {
  id: Guid;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DiningAreaInput {
  name: string;
  sortOrder: number;
  isActive: boolean;
}
