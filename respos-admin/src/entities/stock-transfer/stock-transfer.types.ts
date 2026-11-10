import type { StatusTone } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

export const TRANSFER_STATUSES = ['draft', 'sent', 'received', 'cancelled'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export type TransferDirection = 'outgoing' | 'incoming';

export const TRANSFER_STATUS_TONES = {
  draft: 'neutral',
  sent: 'info',
  received: 'success',
  cancelled: 'danger',
} as const satisfies Record<TransferStatus, StatusTone>;

export interface StockTransferLineDto {
  id: Guid;
  ingredientId: Guid;
  ingredientName: string;
  quantity: number;
  unitId: Guid;
  unitCode: string;
  /** Fixed on send. */
  baseQuantity: number;
  baseUnitCode: string;
  /** Per base unit, fixed on send. */
  unitCost: number | null;
}

/** `direction` is relative to the current branch (X-Branch-Id). */
export interface StockTransferDto {
  id: Guid;
  number: number;
  fromBranchId: Guid;
  fromBranchName: string;
  toBranchId: Guid;
  toBranchName: string;
  status: TransferStatus;
  direction: TransferDirection;
  comment: string | null;
  totalCost: number;
  lineCount: number;
  createdAt: Iso8601;
  sentAt: Iso8601 | null;
  receivedAt: Iso8601 | null;
  cancelledAt: Iso8601 | null;
  lines: StockTransferLineDto[];
}

export interface TransferListParams extends PageParams {
  status?: TransferStatus;
  direction?: TransferDirection;
}

export interface TransferInput {
  toBranchId: string;
  comment?: string;
  lines: { ingredientId: string; quantity: number; unitId: string }[];
}

export type TransferAction = 'send' | 'cancel';
