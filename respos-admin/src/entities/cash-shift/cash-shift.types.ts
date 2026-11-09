import type { CashShiftStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';
import type { PaymentMethod } from '@/entities/payment/payment.types';

/**
 * CashShiftDto (backend `Payments/Common/PaymentDtos.cs`) — the same shape from current/list/get/open/close.
 * For an open shift `expectedCashAmount` is the live expected cash (opening + cash payments − cash refunds,
 * DECISIONS_v1_1 §2); `actualCashAmount`/`difference` are set on close. `totalsByMethod` = payments − refunds per method.
 */
export interface CashShiftDto {
  id: Guid;
  status: CashShiftStatus;
  openedBy: Guid;
  openedByName: string | null;
  openedAt: Iso8601;
  openingAmount: number;
  closedBy: Guid | null;
  closedByName: string | null;
  closedAt: Iso8601 | null;
  expectedCashAmount: number | null;
  actualCashAmount: number | null;
  difference: number | null;
  comment: string | null;
  cashPaymentsAmount: number;
  cashRefundsAmount: number;
  totalsByMethod: { method: PaymentMethod; amount: number }[];
}

/** Kept for readability at call sites: the detail endpoint returns the same DTO. */
export type CashShiftDetailDto = CashShiftDto;

/** `GET /cash-shifts`: `sort` is ignored by the server (always openedAt desc); `from`/`to` are UTC instants. */
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
