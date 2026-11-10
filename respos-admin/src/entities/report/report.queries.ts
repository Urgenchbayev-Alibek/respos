import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type {
  CashShiftReportRowDto,
  MovementTotalDto,
  PaymentMethodTotalDto,
  ReportExportName,
  ReportPeriod,
  SalesByCategoryDto,
  SalesReportDto,
  StockBalanceRowDto,
  TopItemDto,
} from './report.types';

export const reportKeys = {
  all: ['reports'] as const,
  one: (name: string, params: object = {}) => [...reportKeys.all, name, params] as const,
};

const TOP_ITEMS_LIMIT = 10;

/** Branch-scoped (X-Branch-Id), server-calculated in branch timezone. */
function useReport<T>(name: string, path: string, params: Record<string, string | number> = {}) {
  return useQuery({
    queryKey: reportKeys.one(name, params),
    queryFn: ({ signal }) => apiClient.get<T>(path, { params, signal }),
    placeholderData: keepPreviousData,
  });
}

export const useSalesReport = (period: ReportPeriod) =>
  useReport<SalesReportDto>('sales', ENDPOINTS.reports.sales, { ...period });
export const useTopItemsReport = (period: ReportPeriod) =>
  useReport<TopItemDto[]>('top-items', ENDPOINTS.reports.topItems, { ...period, limit: TOP_ITEMS_LIMIT });
export const useSalesByCategoryReport = (period: ReportPeriod) =>
  useReport<SalesByCategoryDto[]>('sales-by-category', ENDPOINTS.reports.salesByCategory, { ...period });
export const usePaymentMethodsReport = (period: ReportPeriod) =>
  useReport<PaymentMethodTotalDto[]>('payment-methods', ENDPOINTS.reports.paymentMethods, { ...period });
export const useStockReport = () => useReport<StockBalanceRowDto[]>('stock', ENDPOINTS.reports.stock);
export const useLowStockReport = () => useReport<StockBalanceRowDto[]>('low-stock', ENDPOINTS.reports.lowStock);
export const useMovementTotalsReport = (period: ReportPeriod) =>
  useReport<MovementTotalDto[]>('stock-movements', ENDPOINTS.reports.stockMovements, { ...period });
export const useCashShiftsReport = (period: ReportPeriod) =>
  useReport<CashShiftReportRowDto[]>('cash-shifts', ENDPOINTS.reports.cashShifts, { ...period });

/** Saves a Blob as a file via a temporary object URL. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** CSV export through the api-client (auth + branch headers apply), then downloaded as a file. */
export function useExportReport() {
  return useMutation({
    mutationFn: async ({ name, period }: { name: ReportExportName; period?: ReportPeriod }) => {
      const csv = await apiClient.get<string>(ENDPOINTS.reports.export(name), {
        params: { format: 'csv', ...period },
        headers: { Accept: 'text/csv' },
      });
      const suffix = period ? `_${period.from}_${period.to}` : '';
      // response.text() strips the server's UTF-8 BOM; restore it so Excel reads Cyrillic correctly.
      saveBlob(new Blob(['﻿', csv ?? ''], { type: 'text/csv;charset=utf-8' }), `${name}${suffix}.csv`);
    },
  });
}
