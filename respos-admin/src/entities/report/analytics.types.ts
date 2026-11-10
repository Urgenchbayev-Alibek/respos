import type { Guid } from '@/shared/types/api-response';
import type { SalesReportDto } from './report.types';

/** F5 analytics DTOs (respos-contracts/v2/F5-analytics.md). Money/quantities are numbers, dates `YYYY-MM-DD`. */
export type AbcMetric = 'revenue' | 'quantity' | 'margin';
export type AbcClass = 'A' | 'B' | 'C';

export interface AbcItemDto {
  menuItemId: Guid;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  margin: number;
  value: number;
  sharePercent: number;
  cumulativePercent: number;
  class: AbcClass;
}

export interface AbcReportDto {
  metric: AbcMetric;
  total: number;
  items: AbcItemDto[];
}

export interface FoodCostItemDto {
  menuItemId: Guid;
  variantId: Guid | null;
  name: string;
  variantName: string | null;
  categoryName: string;
  price: number;
  hasRecipe: boolean;
  hasMissingConversions: boolean;
  recipeCost: number;
  foodCostPercent: number | null;
  marginAmount: number;
  marginPercent: number | null;
  isAboveThreshold: boolean;
}

export interface FoodCostReportDto {
  thresholdPercent: number;
  aboveThresholdCount: number;
  items: FoodCostItemDto[];
}

/** `tipsAmount` stays 0 until payments carry tips (F2). */
export interface WaiterPerformanceDto {
  waiterId: Guid;
  name: string;
  ordersCount: number;
  revenue: number;
  averageCheck: number;
  itemsSold: number;
  cancelledOrders: number;
  cancelledItems: number;
  discountsAmount: number;
  tipsAmount: number;
}

/** ISO weekday 1 (Mon) … 7 (Sun), hour 0–23, branch timezone. */
export interface HeatmapCellDto {
  weekday: number;
  hour: number;
  orders: number;
  revenue: number;
}

export interface HeatmapReportDto {
  maxRevenue: number;
  maxOrders: number;
  cells: HeatmapCellDto[];
}

export interface StaffAmountDto {
  waiterId: Guid;
  name: string;
  count: number;
  amount: number;
}

export interface DiscountsCancellationsDto {
  discounts: {
    ordersCount: number;
    amount: number;
    byWaiter: StaffAmountDto[];
    orders: {
      orderId: Guid;
      number: number;
      businessDate: string;
      waiterName: string | null;
      discountType: 'none' | 'percent' | 'amount';
      discountValue: number;
      subtotal: number;
      discountAmount: number;
      total: number;
    }[];
  };
  cancellations: {
    ordersCount: number;
    ordersAmount: number;
    itemsCount: number;
    itemsAmount: number;
    byReason: { reason: string; ordersCount: number; itemsCount: number; amount: number }[];
    byWaiter: StaffAmountDto[];
  };
}

export interface SalesTotalsDto {
  revenue: number;
  grossRevenue: number;
  refunds: number;
  ordersCount: number;
  averageCheck: number;
  itemsSold: number;
  discountsAmount: number;
  guestsCount: number;
}

/** Δ % vs the previous equal period; `null` when the previous value is 0. */
export interface SalesDeltasDto {
  revenue: number | null;
  ordersCount: number | null;
  averageCheck: number | null;
  itemsSold: number | null;
  discountsAmount: number | null;
  guestsCount: number | null;
}

export interface SalesSummaryDto {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  current: SalesTotalsDto;
  previous: SalesTotalsDto;
  deltas: SalesDeltasDto;
  byDay: SalesReportDto['byDay'];
  previousByDay: SalesReportDto['byDay'];
}

export type DashboardPeriod = 'today' | '7d' | '30d';

export interface DashboardDishDto {
  menuItemId: Guid;
  name: string;
  quantity: number;
  revenue: number;
  margin: number;
}

export interface DashboardOverviewDto {
  period: DashboardPeriod;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  current: SalesTotalsDto;
  previous: SalesTotalsDto;
  deltas: SalesDeltasDto;
  /** Hourly (`hour` set) for today, daily otherwise. */
  sparkline: { date: string; hour: number | null; revenue: number; orders: number }[];
  topItems: DashboardDishDto[];
  bottomItems: DashboardDishDto[];
  foodCostAlerts: FoodCostReportDto;
  isDemoData: boolean;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
