import type { InventoryCountStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export const MOVEMENT_TYPES = [
  'receipt', 'consumption', 'write_off', 'adjustment', 'inventory_count', 'transfer_in', 'transfer_out',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Types a user may create manually (`POST /stock/movements`). */
export const MANUAL_MOVEMENT_TYPES = ['receipt', 'write_off', 'adjustment'] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

export const MOVEMENT_SOURCE_TYPES = ['order', 'purchase', 'manual', 'inventory_count'] as const;
export type MovementSourceType = (typeof MOVEMENT_SOURCE_TYPES)[number];

export interface StockMovementDto {
  id: Guid;
  ingredientId: Guid;
  ingredientName: string;
  baseUnitCode?: string | null;
  type: MovementType;
  /** Signed, in the ingredient base unit. */
  quantity: number;
  balanceAfter: number;
  unitCost: number | null;
  sourceType: MovementSourceType;
  sourceId: Guid | null;
  reason: string | null;
  createdByName?: string | null;
  createdAt: Iso8601;
}

export interface MovementListParams extends PageParams {
  ingredientId?: string;
  type?: MovementType;
  sourceType?: MovementSourceType;
  from?: string;
  to?: string;
}

export interface CreateMovementInput {
  ingredientId: string;
  type: ManualMovementType;
  quantity: number;
  unitId?: string;
  unitCost?: number;
  reason: string;
}

export interface InventoryCountLineDto {
  ingredientId: Guid;
  ingredientName: string;
  unitCode?: string | null;
  expectedQty: number;
  countedQty: number | null;
}

export interface InventoryCountDto {
  id: Guid;
  number?: string | number | null;
  status: InventoryCountStatus;
  createdAt: Iso8601;
  completedAt?: Iso8601 | null;
  createdByName?: string | null;
  lines?: InventoryCountLineDto[];
}

export interface CountLineInput {
  ingredientId: string;
  countedQty: number;
}
