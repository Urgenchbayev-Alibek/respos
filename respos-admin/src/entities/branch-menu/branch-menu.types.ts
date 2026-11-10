import type { Guid } from '@/shared/types/api-response';

export interface BranchVariantPriceDto {
  variantId: Guid;
  variantName: string;
  basePrice: number;
  priceOverride: number | null;
  effectivePrice: number;
}

/** One branch row of `GET /menu/items/{id}/branches`; null override fields inherit the org-level value. */
export interface BranchMenuItemDto {
  branchId: Guid;
  branchName: string;
  menuItemId: Guid;
  hasOverride: boolean;
  priceOverride: number | null;
  isAvailable: boolean | null;
  kitchenStationId: Guid | null;
  kitchenStationName: string | null;
  effectivePrice: number;
  effectiveIsAvailable: boolean;
  effectiveKitchenStationId: Guid | null;
  variants: BranchVariantPriceDto[];
}

export interface BranchMenuItemInput {
  priceOverride: number | null;
  isAvailable: boolean | null;
  kitchenStationId: string | null;
  variantPrices: { variantId: string; price: number }[];
}
