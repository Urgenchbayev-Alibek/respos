import type { Guid, Iso8601 } from '@/shared/types/api-response';

export interface RecipeIngredientDto {
  ingredientId: Guid;
  ingredientName: string;
  quantity: number;
  unitId: Guid;
  unitCode: string;
}

/** `GET /recipes?menuItemId=` (ENDPOINTS.md "Recipes"). */
export interface RecipeDto {
  id: Guid;
  menuItemId: Guid;
  menuItemName: string;
  variantId: Guid | null;
  version: number;
  effectiveFrom: Iso8601;
  isActive: boolean;
  ingredients: RecipeIngredientDto[];
  estimatedCost: number | null;
}

/** `POST /recipes` creates a new version and deactivates the previous one. */
export interface SaveRecipeInput {
  menuItemId: string;
  variantId?: string | null;
  effectiveFrom?: string;
  ingredients: { ingredientId: string; quantity: number; unitId: string }[];
}

/** Minimal menu item shape used by the recipe picker (`GET /menu/items`). */
export interface RecipeMenuItem {
  id: Guid;
  name: string;
  categoryName: string | null;
  isArchived: boolean;
  variants: { id: Guid; name: string; price: number; isDefault: boolean }[];
}
