import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/api-client';
import { ENDPOINTS } from '@/shared/api/endpoints';
import type { Guid, Iso8601 } from '@/shared/types/api-response';

/** `GET /dashboard` — server-calculated, branch timezone (ENDPOINTS.md "Reports & dashboard"). */
export interface DashboardDto {
  salesToday: number;
  ordersToday: number;
  averageCheck: number;
  activeOrders: number;
  tablesOccupied: number;
  tablesTotal: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  lowStockCount: number;
  currentShift: { id: Guid; openedAt: Iso8601; openedByName: string | null } | null;
  isDemoData: boolean;
}

export const dashboardKeys = { all: ['dashboard'] as const };
const DASHBOARD_REFRESH_MS = 60_000;

/** Branch-scoped (X-Branch-Id); refreshed every minute and invalidated by realtime order/payment events. */
export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: ({ signal }) => apiClient.get<DashboardDto>(ENDPOINTS.dashboard, { signal }),
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
}
