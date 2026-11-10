import type { Guid } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/** `GET /ingredients` item; quantity/minQuantity are for the current branch (X-Branch-Id). */
export interface IngredientDto {
  id: Guid;
  name: string;
  sku: string | null;
  categoryId: Guid | null;
  categoryName: string | null;
  baseUnitId: Guid;
  baseUnitCode: string;
  costPrice: number;
  quantity: number;
  minQuantity: number;
  isLow: boolean;
  isArchived: boolean;
  /** Supplier that groups purchase suggestions (F4). */
  defaultSupplierId?: Guid | null;
  defaultSupplierName?: string | null;
}

export interface IngredientListParams extends PageParams {
  categoryId?: string;
  lowStock?: boolean;
}

export interface IngredientInput {
  name: string;
  sku?: string;
  categoryId?: string | null;
  baseUnitId: string;
  costPrice: number;
  /** Current-branch minimum; omitted = unchanged. */
  minQuantity?: number | null;
  defaultSupplierId?: string | null;
}

export interface IngredientCategoryDto {
  id: Guid;
  name: string;
  isArchived: boolean;
}
