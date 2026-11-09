import type { CashShiftStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';

/** Period in branch timezone, `YYYY-MM-DD` (inclusive). */
export interface ReportPeriod {
  from: string;
  to: string;
}

export interface SalesReportDto {
  totalRevenue: number;
  ordersCount: number;
  averageCheck: number;
  byDay: { date: string; revenue: number; orders: number }[];
  isDemoData?: boolean;
}

export interface TopItemDto {
  menuItemId: Guid;
  name: string;
  quantity: number;
  revenue: number;
}

export interface SalesByCategoryDto {
  categoryId: Guid | null;
  name: string;
  revenue: number;
  quantity: number;
}

export interface PaymentMethodTotalDto {
  method: 'cash' | 'card' | 'other';
  amount: number;
  count: number;
}

export interface StockBalanceRowDto {
  ingredientId: Guid;
  name: string;
  unitCode: string;
  quantity: number;
  minQuantity: number;
  isLow: boolean;
  costPrice?: number | null;
}

export interface MovementTotalDto {
  type: string;
  count: number;
  quantity?: number | null;
  totalCost?: number | null;
}

export interface CashShiftReportRowDto {
  id: Guid;
  openedAt: Iso8601;
  closedAt: Iso8601 | null;
  openedByName: string | null;
  status: CashShiftStatus;
  openingAmount: number;
  expectedCashAmount: number | null;
  actualCashAmount: number | null;
  difference: number | null;
}

/** Names accepted by `GET /reports/{name}/export?format=csv`. */
export const REPORT_EXPORT_NAMES = [
  'sales', 'top-items', 'sales-by-category', 'payment-methods', 'stock', 'low-stock', 'stock-movements', 'cash-shifts',
] as const;
export type ReportExportName = (typeof REPORT_EXPORT_NAMES)[number];
