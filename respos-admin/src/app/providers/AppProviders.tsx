import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createQueryClient } from '@/shared/api/query-client';
import { i18n } from '@/shared/i18n';
import { ToastProvider } from '@/shared/ui';
import { AuthProvider } from './AuthProvider';
import { BranchProvider } from './BranchProvider';
import { ConnectionToast } from './ConnectionToast';
import { RealtimeProvider } from './RealtimeProvider';

export interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
  /** Tests disable the SignalR connection. */
  realtime?: boolean;
}

export function AppProviders({ children, queryClient, realtime = true }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ConnectionToast />
          <AuthProvider>
            <BranchProvider>{realtime ? <RealtimeProvider>{children}</RealtimeProvider> : children}</BranchProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
