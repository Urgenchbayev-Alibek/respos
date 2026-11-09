import type { CashShiftStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';
import type { PaymentMethod } from '@/entities/payment/payment.types';

/**
 * CashShift (DOMAIN_MODEL.md "Payments & cash"). Server computes `expectedCashAmount`
 * (opening + cash payments − cash refunds, DECISIONS_v1_1 §2) and `difference` on close.
 */
export interface CashShiftDto {
  id: Guid;
  status: CashShiftStatus;
  openedById?: Guid;
  openedByName: string | null;
  openedAt: Iso8601;
  openingAmount: number;
  closedByName: string | null;
  closedAt: Iso8601 | null;
  /** For an open shift: the server's running expected cash (may be absent). */
  expectedCashAmount: number | null;
  actualCashAmount: number | null;
  difference: number | null;
  comment: string | null;
}

export interface CashShiftDetailDto extends CashShiftDto {
  totalsByMethod: { method: PaymentMethod; amount: number }[];
}

export interface CashShiftListParams extends PageParams {
  status?: CashShiftStatus;
  from?: string;
  to?: string;
}

export interface OpenShiftInput {
  openingAmount: number;
}

export interface CloseShiftInput {
  actualCashAmount: number;
  comment?: string;
}
