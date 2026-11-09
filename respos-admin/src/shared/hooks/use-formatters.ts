import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/shared/constants/locale';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate, formatDateTime, formatTime } from '@/shared/lib/format-date';
import { useAuth } from './use-auth';
import { useCurrentBranch } from './use-current-branch';

type DateInput = string | number | Date | null | undefined;

/** Formatters bound to org currency, UI language and current branch timezone. */
export function useFormatters() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { branch } = useCurrentBranch();
  const currency = user?.currentOrganization?.currency ?? DEFAULT_CURRENCY;
  const timeZone = branch?.timezone ?? DEFAULT_TIMEZONE;
  const locale = i18n.language;

  return useMemo(
    () => ({
      currency,
      timeZone,
      money: (amount: number | null | undefined) => formatCurrency(amount, { currency, locale }),
      number: (value: number | null | undefined, digits = 3) =>
        value === null || value === undefined
          ? '—'
          : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value),
      date: (value: DateInput) => formatDate(value, { timeZone, locale }),
      time: (value: DateInput) => formatTime(value, { timeZone, locale }),
      dateTime: (value: DateInput) => formatDateTime(value, { timeZone, locale }),
    }),
    [currency, timeZone, locale],
  );
}
