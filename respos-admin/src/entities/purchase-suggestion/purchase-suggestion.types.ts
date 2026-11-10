import type { Guid } from '@/shared/types/api-response';

/** Quantities are in the ingredient base unit. */
export interface PurchaseSuggestionLineDto {
  ingredientId: Guid;
  ingredientName: string;
  baseUnitId: Guid;
  baseUnitCode: string;
  currentQuantity: number;
  minQuantity: number;
  onOrderQuantity: number;
  avgDailyConsumption: number;
  targetQuantity: number;
  suggestedQuantity: number;
  lastPrice: number;
  estimatedTotal: number;
}

/** `supplierId` null = ingredients without an (active) default supplier. */
export interface PurchaseSuggestionGroupDto {
  supplierId: Guid | null;
  supplierName: string | null;
  estimatedTotal: number;
  lines: PurchaseSuggestionLineDto[];
}

export interface PurchaseSuggestionsDto {
  coverageDays: number;
  lookbackDays: number;
  groups: PurchaseSuggestionGroupDto[];
}

export interface PurchaseSuggestionParams {
  coverageDays: number;
  lookbackDays?: number;
}

export interface ApplySuggestionsInput {
  comment?: string;
  lines: {
    ingredientId: string;
    supplierId: string;
    quantity: number;
    unitPrice?: number;
  }[];
}
