import { useTranslation } from 'react-i18next';
import { PAYMENT_METHODS } from '@/entities/payment/payment.types';
import { clickShortcutTarget, focusShortcutTarget, useShortcuts } from '@/shared/hooks/use-shortcuts';

/** Cashier: F2 — order search, Enter — pay, 1/2/3 — payment method (targets are `data-shortcut` attributes). */
export function useCashierShortcuts(): void {
  const { t } = useTranslation('ux');
  useShortcuts([
    { keys: 'F2', label: t('shortcuts.cashier.search'), handler: () => focusShortcutTarget('order-search') },
    { keys: 'Enter', label: t('shortcuts.cashier.pay'), handler: () => clickShortcutTarget('pay-submit') },
    ...PAYMENT_METHODS.map((method, index) => ({
      keys: String(index + 1),
      label: t('shortcuts.cashier.method', { method: t(`payments:methods.${method}`) }),
      handler: () => clickShortcutTarget(`pay-method-${index + 1}`),
    })),
  ]);
}
