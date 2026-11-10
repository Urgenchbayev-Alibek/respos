import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashShiftKeys } from '@/entities/cash-shift/cash-shift.queries';
import { orderKeys } from '@/entities/order/order.queries';
import type { OrderDto } from '@/entities/order/order.types';
import { paymentKeys } from '@/entities/payment/payment.queries';
import { apiClient } from '@/shared/api/api-client';
import type {
  CreatePaymentIntentInput,
  FiscalStatusDto,
  PaymentIntentDto,
  PaymentProviderDto,
  SplitOrderInput,
  TipsReportDto,
} from './billing.types';

const id = (value: string) => encodeURIComponent(value);

/** F2 paths (kept in this module to avoid touching the shared endpoint map). */
export const BILLING_ENDPOINTS = {
  split: (orderId: string) => `/orders/${id(orderId)}/split`,
  providers: '/payments/providers',
  provider: (code: string) => `/payments/providers/${id(code)}`,
  fiscal: '/payments/fiscal',
  intents: '/payments/intents',
  intent: (intentId: string) => `/payments/intents/${id(intentId)}`,
  cancelIntent: (intentId: string) => `/payments/intents/${id(intentId)}/cancel`,
  tipsReport: '/reports/tips',
} as const;

export const billingKeys = {
  all: ['billing'] as const,
  providers: () => [...billingKeys.all, 'providers'] as const,
  fiscal: () => [...billingKeys.all, 'fiscal'] as const,
  intent: (intentId: string) => [...billingKeys.all, 'intent', intentId] as const,
  tips: (params: { from?: string; to?: string }) => [...billingKeys.all, 'tips', params] as const,
};

function useSplitMutation<TVars>(fn: (vars: TVars) => Promise<OrderDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      if (order?.id) queryClient.setQueryData(orderKeys.detail(order.id), order);
      return queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useSplitOrder() {
  return useSplitMutation(({ orderId, input }: { orderId: string; input: SplitOrderInput }) =>
    apiClient.post<OrderDto>(BILLING_ENDPOINTS.split(orderId), input),
  );
}

export function useMergeBills() {
  return useSplitMutation((orderId: string) => apiClient.delete<OrderDto>(BILLING_ENDPOINTS.split(orderId)));
}

export function usePaymentProviders(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.providers(),
    queryFn: ({ signal }) => apiClient.get<PaymentProviderDto[]>(BILLING_ENDPOINTS.providers, { signal }),
    enabled: options.enabled ?? true,
  });
}

export function useSetPaymentProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, isEnabled }: { code: string; isEnabled: boolean }) =>
      apiClient.put<PaymentProviderDto[]>(BILLING_ENDPOINTS.provider(code), { isEnabled }),
    onSuccess: (providers) => queryClient.setQueryData(billingKeys.providers(), providers),
  });
}

export function useFiscalStatus() {
  return useQuery({
    queryKey: billingKeys.fiscal(),
    queryFn: ({ signal }) => apiClient.get<FiscalStatusDto>(BILLING_ENDPOINTS.fiscal, { signal }),
  });
}

export function useCreatePaymentIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentIntentInput) => apiClient.post<PaymentIntentDto>(BILLING_ENDPOINTS.intents, input),
    onSuccess: (intent) => queryClient.setQueryData(billingKeys.intent(intent.id), intent),
  });
}

/** Polls a pending intent every 3 s; when it completes, order/payment/shift data is refetched. */
export function usePaymentIntent(intentId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: billingKeys.intent(intentId ?? ''),
    enabled: Boolean(intentId),
    queryFn: async ({ signal }) => {
      const intent = await apiClient.get<PaymentIntentDto>(BILLING_ENDPOINTS.intent(intentId ?? ''), { signal });
      if (intent.status === 'completed') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: orderKeys.all }),
          queryClient.invalidateQueries({ queryKey: paymentKeys.all }),
          queryClient.invalidateQueries({ queryKey: cashShiftKeys.all }),
        ]);
      }
      return intent;
    },
    refetchInterval: (query) => (query.state.data?.status === 'pending' && !query.state.data.isExpired ? 3000 : false),
  });
}

export function useCancelPaymentIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (intentId: string) => apiClient.post<PaymentIntentDto>(BILLING_ENDPOINTS.cancelIntent(intentId)),
    onSuccess: (intent) => queryClient.setQueryData(billingKeys.intent(intent.id), intent),
  });
}

export function useTipsReport(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: billingKeys.tips(params),
    queryFn: ({ signal }) => apiClient.get<TipsReportDto>(BILLING_ENDPOINTS.tipsReport, { params: { ...params }, signal }),
  });
}
