import { useQueryClient } from '@tanstack/react-query';
import { cashShiftKeys } from '@/entities/cash-shift/cash-shift.queries';
import { payableOrderKeys, paymentKeys } from '@/entities/payment/payment.queries';
import { useRealtimeEvent } from '@/shared/realtime';

/** Cashier screens refetch orders/payments/shift when the server hints at a change. */
export function useCashierRealtime(): void {
  const queryClient = useQueryClient();
  const refetchOrders = () => void queryClient.invalidateQueries({ queryKey: payableOrderKeys.all });
  useRealtimeEvent('OrderUpdated', refetchOrders);
  useRealtimeEvent('PaymentRegistered', () => {
    refetchOrders();
    void queryClient.invalidateQueries({ queryKey: paymentKeys.all });
    void queryClient.invalidateQueries({ queryKey: cashShiftKeys.all });
  });
}
