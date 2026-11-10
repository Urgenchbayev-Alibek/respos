import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, type QueryParams } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type {
  AbcMetric,
  AbcReportDto,
  DashboardOverviewDto,
  DashboardPeriod,
  DiscountsCancellationsDto,
  ExportFormat,
  FoodCostReportDto,
  HeatmapReportDto,
  SalesSummaryDto,
  WaiterPerformanceDto,
} from './analytics.types';
import { reportKeys } from './report.queries';
import type { ReportExportName, ReportPeriod } from './report.types';

function useAnalytics<T>(name: string, path: string, params: Record<string, string | number> = {}) {
  return useQuery({
    queryKey: reportKeys.one(name, params),
    queryFn: ({ signal }) => apiClient.get<T>(path, { params, signal }),
    placeholderData: keepPreviousData,
  });
}

export const useSalesSummary = (period: ReportPeriod) =>
  useAnalytics<SalesSummaryDto>('sales-summary', ENDPOINTS.reports.salesSummary, { ...period });
export const useAbcReport = (period: ReportPeriod, metric: AbcMetric) =>
  useAnalytics<AbcReportDto>('abc', ENDPOINTS.reports.abc, { ...period, metric });
export const useFoodCostReport = (threshold: number) =>
  useAnalytics<FoodCostReportDto>('food-cost', ENDPOINTS.reports.foodCost, { threshold });
export const useWaitersReport = (period: ReportPeriod) =>
  useAnalytics<WaiterPerformanceDto[]>('waiters', ENDPOINTS.reports.waiters, { ...period });
export const useHeatmapReport = (period: ReportPeriod) =>
  useAnalytics<HeatmapReportDto>('heatmap', ENDPOINTS.reports.heatmap, { ...period });
export const useDiscountsCancellationsReport = (period: ReportPeriod) =>
  useAnalytics<DiscountsCancellationsDto>('discounts-cancellations', ENDPOINTS.reports.discountsCancellations, { ...period });

export const dashboardOverviewKeys = { all: ['dashboard', 'overview'] as const };
const OVERVIEW_REFRESH_MS = 60_000;

export function useDashboardOverview(period: DashboardPeriod) {
  return useQuery({
    queryKey: [...dashboardOverviewKeys.all, period],
    queryFn: ({ signal }) => apiClient.get<DashboardOverviewDto>(ENDPOINTS.dashboardOverview, { params: { period }, signal }),
    placeholderData: keepPreviousData,
    refetchInterval: OVERVIEW_REFRESH_MS,
  });
}

const EXTENSIONS: Record<ExportFormat, string> = { csv: 'csv', xlsx: 'xlsx', pdf: 'html' };

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Prints the server's script-free print layout in a hidden iframe (browser "Save as PDF"). */
function printBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  frame.src = url;
  document.body.append(frame);
}

export interface ExportRequest {
  name: ReportExportName;
  format: ExportFormat;
  period?: ReportPeriod;
  /** Extra report params: metric (abc), threshold (food-cost), shiftId (z-report), limit (top-items). */
  params?: QueryParams;
  language?: string;
}

/** `GET /reports/{name}/export` via the api-client (auth + branch headers); csv/xlsx download, pdf prints. */
export function useReportExport() {
  return useMutation({
    mutationFn: async ({ name, format, period, params, language }: ExportRequest) => {
      const blob = await apiClient.get<Blob>(ENDPOINTS.reports.export(name), {
        params: { format, lang: language, ...period, ...params },
        headers: { Accept: '*/*' },
        responseType: 'blob',
      });
      if (format === 'pdf') {
        printBlob(blob);
        return;
      }
      const suffix = period ? `_${period.from}_${period.to}` : '';
      saveBlob(blob, `${name}${suffix}.${EXTENSIONS[format]}`);
    },
  });
}
