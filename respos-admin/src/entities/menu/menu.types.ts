import type { Guid } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/** Menu is org-scoped (respos-contracts/ENDPOINTS.md "Menu"). */
export interface MenuCategoryDto {
  id: Guid;
  name: string;
  nameUz: string | null;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
  /** Non-archived items in the category. */
  itemCount: number;
}

/** `sortOrder` omitted = keep (update) / append (create). */
export interface MenuCategoryInput {
  name: string;
  nameUz?: string;
  sortOrder?: number;
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

/** .NET `DayOfWeek` serialized snake_case. */
export type DayOfWeekName = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

/** Orderable window in branch time; `dayOfWeek` null = every day; `endTime <= startTime` = overnight. Times `HH:mm:ss`. */
export interface MenuAvailabilityDto {
  dayOfWeek: DayOfWeekName | null;
  startTime: string;
  endTime: string;
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
  prepTimeMinutes: number;
  kitchenStationId: Guid | null;
  isAvailable: boolean;
  isArchived: boolean;
  sku: string | null;
  variants: MenuItemVariantDto[];
  modifierGroups: ModifierGroupDto[];
  availability: MenuAvailabilityDto[];
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
  /** Backend `int` (not nullable): 0 = not set. */
  prepTimeMinutes: number;
  kitchenStationId: string | null;
  isAvailable: boolean;
  /** Lists replace the item's children; omitted (undefined) = keep as is. */
  variants: { id?: string; name: string; price: number; isDefault: boolean }[];
  modifierGroupIds: string[];
  availability?: MenuAvailabilityDto[];
}

/** `GET /menu/pos` returns a plain array: active categories with items orderable now (available, not archived, inside an availability window); empty categories omitted. */
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
