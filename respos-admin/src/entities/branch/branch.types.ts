import type { Guid } from '@/shared/types/api-response';

export interface BranchDto {
  id: Guid;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  isActive: boolean;
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
  receiptFooter: string | null;
}
