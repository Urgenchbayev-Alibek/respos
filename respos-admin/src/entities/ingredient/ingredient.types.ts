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
  costPrice: number | null;
  quantity: number;
  minQuantity: number;
  isLow: boolean;
  isArchived: boolean;
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
  costPrice?: number;
}

export interface IngredientCategoryDto {
  id: Guid;
  name: string;
}
