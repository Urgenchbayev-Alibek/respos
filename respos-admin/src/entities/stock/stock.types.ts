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
  baseUnitCode: string;
  type: MovementType;
  /** Signed, in the ingredient base unit (write_off/consumption are negative). */
  quantity: number;
  balanceAfter: number;
  unitCost: number | null;
  sourceType: MovementSourceType;
  sourceId: Guid | null;
  reason: string | null;
  createdBy: Guid | null;
  createdByName: string | null;
  createdAt: Iso8601;
}

/** `from`/`to` are ISO 8601 instants (backend DateTime, `to` inclusive) — use `dateRangeToUtc`. */
export interface MovementListParams extends PageParams {
  ingredientId?: string;
  type?: MovementType;
  sourceType?: MovementSourceType;
  from?: string;
  to?: string;
}

/** `quantity` is in `unitId` (default: base unit): receipt/write_off positive (write_off is applied as −qty), adjustment signed. */
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
  baseUnitCode: string;
  expectedQty: number;
  countedQty: number | null;
  /** countedQty − expectedQty (null until counted). */
  difference: number | null;
}

/** `GET /stock/counts` item. */
export interface InventoryCountSummaryDto {
  id: Guid;
  status: InventoryCountStatus;
  comment: string | null;
  createdAt: Iso8601;
  completedAt: Iso8601 | null;
  lineCount: number;
}

/** `GET /stock/counts/{id}`, `POST/PUT /stock/counts…`, `POST …/complete`. */
export interface InventoryCountDto {
  id: Guid;
  status: InventoryCountStatus;
  comment: string | null;
  createdAt: Iso8601;
  completedAt: Iso8601 | null;
  lines: InventoryCountLineDto[];
}

export interface CreateCountInput {
  comment?: string;
  /** Default: all active ingredients. */
  ingredientIds?: string[];
}

export interface CountLineInput {
  ingredientId: string;
  /** null clears a counted value. */
  countedQty: number | null;
}
