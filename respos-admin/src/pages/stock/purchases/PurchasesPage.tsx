import { Lightbulb, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchases } from '@/entities/purchase/purchase.queries';
import type { PurchaseDto } from '@/entities/purchase/purchase.types';
import { useSupplierOptions } from '@/entities/supplier/supplier.queries';
import { PurchaseSuggestionsModal } from '@/features/purchase-suggestions/ui/PurchaseSuggestionsModal';
import { PurchaseFormModal } from '@/features/purchases/ui/PurchaseFormModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { PURCHASE_STATUSES, type PurchaseStatus } from '@/shared/constants/statuses';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { dateRangeToUtc } from '@/shared/lib/zoned-time';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { Button, DataTable, Input, PageHeader, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';

interface Filters {
  status: PurchaseStatus | '';
  supplierId: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { status: '', supplierId: '', from: '', to: '' };

/** Purchase orders of the current branch. Row → detail (relative route `:purchaseId`). */
export function PurchasesPage() {
  const { t } = useTranslation('purchases');
  const format = useFormatters();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const suppliers = useSupplierOptions();
  const query = usePurchases({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: 'createdAt:desc',
    status: filters.status || undefined,
    supplierId: filters.supplierId || undefined,
    ...dateRangeToUtc(filters.from || undefined, filters.to || undefined, format.timeZone),
  });
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const open = (purchase: PurchaseDto) => navigate(purchase.id);

  const columns = useMemo<DataTableColumn<PurchaseDto>[]>(
    () => [
      { key: 'number', header: t('columns.number'), cell: (row) => <Link to={row.id} onClick={(event) => event.stopPropagation()}><strong>{row.number}</strong></Link> },
      { key: 'supplier', header: t('columns.supplier'), cell: (row) => row.supplierName },
      { key: 'status', header: t('columns.status'), cell: (row) => <StatusBadge domain="purchase" status={row.status} /> },
      { key: 'expected', header: t('columns.expectedAt'), hideOnMobile: true, cell: (row) => format.date(row.expectedAt) },
      { key: 'total', header: t('columns.total'), align: 'right', cell: (row) => format.money(row.total) },
    ],
    [t, format],
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <>
            <Button icon={<Lightbulb />} onClick={() => setSuggesting(true)}>{t('purchaseSuggestions:open')}</Button>
            {hasPermission(PERMISSIONS.purchases.manage) && (
              <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>{t('actions.create')}</Button>
            )}
          </>
        }
      />
      <Toolbar
        actions={Object.values(filters).some(Boolean) && <Button variant="ghost" onClick={() => { setFilters(EMPTY); setPage(1); }}>{t('filters.reset')}</Button>}
      >
        <Select
          aria-label={t('columns.status')}
          placeholder={t('filters.allStatuses')}
          value={filters.status}
          onChange={(event) => update('status', event.target.value as PurchaseStatus | '')}
          options={PURCHASE_STATUSES.map((status) => ({ value: status, label: t(`status:purchase.${status}`) }))}
        />
        <Select
          aria-label={t('columns.supplier')}
          placeholder={t('filters.allSuppliers')}
          value={filters.supplierId}
          onChange={(event) => update('supplierId', event.target.value)}
          options={(suppliers.data?.items ?? []).map((supplier) => ({ value: supplier.id, label: supplier.name }))}
        />
        <Input type="date" aria-label={t('filters.from')} value={filters.from} onChange={(event) => update('from', event.target.value)} />
        <Input type="date" aria-label={t('filters.to')} value={filters.to} onChange={(event) => update('to', event.target.value)} />
      </Toolbar>
      <DataTable
        caption={t('title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(row) => row.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('empty')}
        onRowClick={open}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      <PurchaseFormModal open={creating} onClose={() => setCreating(false)} onSaved={open} />
      <PurchaseSuggestionsModal open={suggesting} onClose={() => setSuggesting(false)} />
    </>
  );
}
