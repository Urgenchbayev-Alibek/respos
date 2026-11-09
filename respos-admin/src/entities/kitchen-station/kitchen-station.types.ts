import type { Guid } from '@/shared/types/api-response';

/** KitchenStation (branch-scoped). */
export interface KitchenStationDto {
  id: Guid;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface KitchenStationInput {
  name: string;
  sortOrder: number;
  isActive: boolean;
}
