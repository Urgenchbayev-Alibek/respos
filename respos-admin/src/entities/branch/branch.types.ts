import type { Guid } from '@/shared/types/api-response';

export interface BranchDto {
  id: Guid;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  isActive: boolean;
  /** Public QR-menu slug (F3). */
  slug?: string | null;
}

export interface BranchInput {
  name: string;
  address?: string;
  phone?: string;
  timezone: string;
}

export interface BranchSettingsDto {
  serviceChargePercent: number;
  taxPercent: number;
  allowNegativeStock: boolean;
  /** Read-only in MVP: stock is written off on payment. */
  inventoryConsumptionTrigger: 'on_payment';
  receiptFooter: string | null;
}

/** `PUT /branches/{id}/settings` body. */
export type BranchSettingsInput = Omit<BranchSettingsDto, 'inventoryConsumptionTrigger'>;
