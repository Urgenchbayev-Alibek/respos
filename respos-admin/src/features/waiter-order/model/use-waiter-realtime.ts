import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { orderKeys } from '@/entities/order/order.queries';
import { tableKeys } from '@/entities/table/table.queries';
import type { TableDto } from '@/entities/table/table.types';
import { useRealtimeEvent } from '@/shared/realtime';
import { useToast } from '@/shared/ui';

/**
 * Waiter realtime: TableUpdated / OrderUpdated refetch the floor and orders; OrderItemReady shows a toast.
 * Events are hints only — the UI always refetches from REST.
 */
export function useWaiterRealtime() {
  const { t } = useTranslation('waiter');
  const toast = useToast();
  const queryClient = useQueryClient();

  const refreshTables = () => void queryClient.invalidateQueries({ queryKey: tableKeys.all });
  const refreshOrders = () => void queryClient.invalidateQueries({ queryKey: orderKeys.all });

  useRealtimeEvent('TableUpdated', refreshTables);
  useRealtimeEvent('OrderUpdated', () => {
    refreshOrders();
    refreshTables();
  });
  useRealtimeEvent('OrderItemReady', (event) => {
    refreshOrders();
    const tables = queryClient.getQueriesData<TableDto[]>({ queryKey: tableKeys.all }).flatMap(([, data]) => data ?? []);
    const table = tables.find((candidate) => candidate.id === event.tableId);
    toast.show({
      tone: 'success',
      title: t('toast.itemReady'),
      description: table ? t('toast.itemReadyTable', { table: table.number, item: event.itemName }) : event.itemName,
      duration: 8000,
    });
  });
}
