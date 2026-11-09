import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAYMENT_METHODS, type PaymentMethod } from '@/entities/payment/payment.types';
import { PaymentsTable } from '@/features/payments/ui/PaymentsTable';
import { Button, DemoBadge, Input, PageHeader, Select, Toolbar } from '@/shared/ui';

interface Filters {
  from: string;
  to: string;
  method: PaymentMethod | '';
}

const EMPTY: Filters = { from: '', to: '', method: '' };

/** Admin: all payments of the branch (paged, filters, refund). */
export function PaymentsPage() {
  const { t } = useTranslation('payments');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const dirty = Boolean(filters.from || filters.to || filters.method);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} meta={<DemoBadge title={t('manualProvider')} />} />
      <Toolbar
        actions={
          dirty && (
            <Button variant="ghost" onClick={() => setFilters(EMPTY)}>
              {t('filters.reset')}
            </Button>
          )
        }
      >
        <Input
          type="date"
          aria-label={t('filters.from')}
          value={filters.from}
          onChange={(event) => update('from', event.target.value)}
        />
        <Input type="date" aria-label={t('filters.to')} value={filters.to} onChange={(event) => update('to', event.target.value)} />
        <Select
          aria-label={t('columns.method')}
          placeholder={t('filters.allMethods')}
          value={filters.method}
          onChange={(event) => update('method', event.target.value as PaymentMethod | '')}
          options={PAYMENT_METHODS.map((method) => ({ value: method, label: t(`methods.${method}`) }))}
        />
      </Toolbar>
      <PaymentsTable
        filters={{ from: filters.from || undefined, to: filters.to || undefined, method: filters.method || undefined }}
      />
    </>
  );
}
