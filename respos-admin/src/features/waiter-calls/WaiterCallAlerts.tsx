import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { waiterCallKeys } from '@/entities/waiter-call/waiter-call.queries';
import { useRealtimeEvent } from '@/shared/realtime';
import { useToast } from '@/shared/ui';

/** Waiter workspace: sticky toast when a guest presses "call waiter" / "bill" on the QR menu; refreshes the calls list. */
export function WaiterCallAlerts() {
  const { t } = useTranslation('qrMenu');
  const toast = useToast();
  const queryClient = useQueryClient();

  useRealtimeEvent('WaiterCalled', (payload) => {
    void queryClient.invalidateQueries({ queryKey: waiterCallKeys.all });
    toast.show({
      tone: 'warning',
      title: t(`calls.toast.${payload.reason}`, { number: payload.tableNumber }),
      duration: 0,
    });
  });
  useRealtimeEvent('WaiterCallUpdated', () => void queryClient.invalidateQueries({ queryKey: waiterCallKeys.all }));
  return null;
}
