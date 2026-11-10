import type { CashShiftStatus } from '@/shared/constants/statuses';
import type { MovementType } from '@/entities/stock/stock.types';
import type { Guid, Iso8601 } from '@/shared/types/api-response';

export type PaymentMethod = 'cash' | 'card' | 'other';

/** Period in branch timezone, `YYYY-MM-DD` (inclusive). */
export interface ReportPeriod {
  from: string;
  to: string;
}

export interface SalesReportDto {
  totalRevenue: number;
  ordersCount: number;
  averageCheck: number;
  /** `date` is `YYYY-MM-DD` (branch timezone). */
  byDay: { date: string; revenue: number; orders: number }[];
}

export interface TopItemDto {
  menuItemId: Guid;
  name: string;
  quantity: number;
  revenue: number;
}

export interface SalesByCategoryDto {
  categoryId: Guid;
  name: string;
  revenue: number;
  quantity: number;
}

/** `amount` = payments − refunds of the method; `count` = number of payments. */
export interface PaymentMethodTotalDto {
  method: PaymentMethod;
  amount: number;
  count: number;
  refundedAmount: number;
}

/** `GET /reports/stock` and `/reports/low-stock` row. */
export interface StockBalanceRowDto {
  ingredientId: Guid;
  name: string;
  sku: string | null;
  unitCode: string;
  quantity: number;
  minQuantity: number;
  isLow: boolean;
  costPrice: number;
  /** quantity × costPrice. */
  stockValue: number;
}

/** `GET /reports/stock-movements` row: totals per (type, ingredient); quantity is signed, base unit. */
export interface MovementTotalDto {
  type: MovementType;
  ingredientId: Guid;
  ingredientName: string;
  unitCode: string;
  quantity: number;
  count: number;
}

export interface CashShiftReportRowDto {
  id: Guid;
  openedAt: Iso8601;
  openedByName: string | null;
  closedAt: Iso8601 | null;
  closedByName: string | null;
  status: CashShiftStatus;
  openingAmount: number;
  cashPayments: number;
  cardPayments: number;
  otherPayments: number;
  refunds: number;
  expectedCashAmount: number | null;
  actualCashAmount: number | null;
  difference: number | null;
}

/** Names accepted by `GET /reports/{name}/export?format=csv|xlsx|pdf` (pdf: print layout, see PRINTABLE_REPORTS). */
export const REPORT_EXPORT_NAMES = [
  'sales', 'top-items', 'sales-by-category', 'payment-methods', 'stock', 'low-stock', 'stock-movements', 'cash-shifts',
  'sales-summary', 'abc', 'food-cost', 'waiters', 'heatmap', 'discounts-cancellations', 'z-report',
] as const;
export const PRINTABLE_REPORTS: readonly ReportExportName[] = ['sales-summary', 'z-report'];
export type ReportExportName = (typeof REPORT_EXPORT_NAMES)[number];
