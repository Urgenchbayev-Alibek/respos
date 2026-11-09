import type { Guid } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/** Menu is org-scoped (respos-contracts/ENDPOINTS.md "Menu"). */
export interface MenuCategoryDto {
  id: Guid;
  name: string;
  nameUz: string | null;
  sortOrder: number;
  isActive: boolean;
  isArchived?: boolean;
}

export interface MenuCategoryInput {
  name: string;
  nameUz?: string;
  isActive: boolean;
}

export interface ModifierOptionDto {
  id: Guid;
  name: string;
  priceDelta: number;
}

export interface ModifierGroupDto {
  id: Guid;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOptionDto[];
}

export interface ModifierGroupInput {
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: { id?: string; name: string; priceDelta: number }[];
}

/** Variant price is ABSOLUTE (contract v1.1 §5). */
export interface MenuItemVariantDto {
  id: Guid;
  name: string;
  price: number;
  isDefault: boolean;
}

export interface MenuItemDto {
  id: Guid;
  categoryId: Guid;
  categoryName: string;
  name: string;
  nameUz: string | null;
  description: string | null;
  photoUrl: string | null;
  price: number;
  prepTimeMinutes: number | null;
  kitchenStationId: Guid | null;
  isAvailable: boolean;
  isArchived: boolean;
  sku?: string | null;
  variants: MenuItemVariantDto[];
  modifierGroups: ModifierGroupDto[];
}

export interface MenuItemListParams extends PageParams {
  categoryId?: string;
  isAvailable?: boolean;
  includeArchived?: boolean;
}

export interface MenuItemInput {
  categoryId: string;
  name: string;
  nameUz?: string;
  description?: string;
  sku?: string;
  price: number;
  prepTimeMinutes: number | null;
  kitchenStationId: string | null;
  isAvailable: boolean;
  variants: { id?: string; name: string; price: number; isDefault: boolean }[];
  modifierGroupIds: string[];
}

/** `GET /menu/pos`: categories with available, non-archived items (one call for the waiter screen). */
export interface PosCategoryDto {
  id: Guid;
  name: string;
  nameUz: string | null;
  sortOrder: number;
  items: MenuItemDto[];
}

/** Localized name: Uzbek UI shows `nameUz` when present. */
export function localizedName(entity: { name: string; nameUz?: string | null }, language: string): string {
  return language === 'uz' && entity.nameUz ? entity.nameUz : entity.name;
}
