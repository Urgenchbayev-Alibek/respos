import type { PurchaseStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export interface PurchaseItemDto {
  id: Guid;
  ingredientId: Guid;
  ingredientName: string;
  quantity: number;
  unitId: Guid;
  unitCode: string;
  unitPrice: number;
  receivedQuantity: number;
  lineTotal: number;
}

export interface PurchaseDto {
  id: Guid;
  number: string;
  supplierId: Guid;
  supplierName: string;
  status: PurchaseStatus;
  expectedAt: Iso8601 | null;
  total: number;
  comment: string | null;
  items?: PurchaseItemDto[];
}

export interface PurchaseListParams extends PageParams {
  status?: PurchaseStatus;
  supplierId?: string;
  from?: string;
  to?: string;
}

export interface PurchaseInput {
  supplierId: string;
  expectedAt?: string;
  comment?: string;
  items: { ingredientId: string; quantity: number; unitId: string; unitPrice: number }[];
}

export interface ReceiveInput {
  lines: { itemId: string; quantity: number }[];
}

export type PurchaseAction = 'submit' | 'cancel';
