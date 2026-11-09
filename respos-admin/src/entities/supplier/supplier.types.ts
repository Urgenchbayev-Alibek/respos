import type { Guid } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export interface SupplierDto {
  id: Guid;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  inn: string | null;
  notes: string | null;
  isArchived: boolean;
}

export interface SupplierListParams extends PageParams {
  includeArchived?: boolean;
}

export interface SupplierInput {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  inn?: string;
  notes?: string;
}
