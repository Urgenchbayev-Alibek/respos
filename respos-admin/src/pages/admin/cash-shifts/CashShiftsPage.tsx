import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCashShifts } from '@/entities/cash-shift/cash-shift.queries';
import type { CashShiftDto } from '@/entities/cash-shift/cash-shift.types';
import { formatSignedMoney } from '@/features/cash-shifts/model/shift-format';
import { CASH_SHIFT_STATUSES, type CashShiftStatus } from '@/shared/constants/statuses';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DEFAULT_PAGE_SIZE, toSortParam, type SortState } from '@/shared/types/pagination';
import { DataTable, Input, PageHeader, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';
import { CashShiftDetailDrawer } from './CashShiftDetailDrawer';

interface Filters {
  status: CashShiftStatus | '';
  from: string;
  to: string;
}

/** Admin: cash shifts history; row → detail drawer with totals by method. */
export function CashShiftsPage() {
  const { t } = useTranslation('payments');
  const format = useFormatters();
  const [filters, setFilters] = useState<Filters>({ status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ field: 'openedAt', direction: 'desc' });
  const [selected, setSelected] = useState<string | null>(null);
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const query = useCashShifts({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: toSortParam(sort),
    status: filters.status || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  });

  const columns = useMemo<DataTableColumn<CashShiftDto>[]>(
    () => [
      {
        key: 'openedAt',
        header: t('shifts.columns.openedAt'),
        sortField: 'openedAt',
        cell: (shift) => format.dateTime(shift.openedAt),
      },
      { key: 'openedBy', header: t('shifts.columns.openedBy'), hideOnMobile: true, cell: (shift) => shift.openedByName ?? '—' },
      {
        key: 'status',
        header: t('shifts.columns.status'),
        cell: (shift) => <StatusBadge domain="cashShift" status={shift.status} />,
      },
      {
        key: 'opening',
        header: t('shifts.columns.opening'),
        align: 'right',
        hideOnMobile: true,
        cell: (shift) => format.money(shift.openingAmount),
      },
      {
        key: 'expected',
        header: t('shifts.columns.expected'),
        align: 'right',
        cell: (shift) => format.money(shift.expectedCashAmount),
      },
      {
        key: 'actual',
        header: t('shifts.columns.actual'),
        align: 'right',
        hideOnMobile: true,
        cell: (shift) => format.money(shift.actualCashAmount),
      },
      {
        key: 'difference',
        header: t('shifts.columns.difference'),
        align: 'right',
        cell: (shift) => formatSignedMoney(shift.difference, format.money),
      },
      {
        key: 'closedAt',
        header: t('shifts.columns.closedAt'),
        hideOnMobile: true,
        cell: (shift) => (shift.closedAt ? format.dateTime(shift.closedAt) : '—'),
      },
    ],
    [t, format],
  );

  return (
    <>
      <PageHeader title={t('shifts.title')} description={t('shifts.subtitle')} />
      <Toolbar>
        <Select
          aria-label={t('shifts.columns.status')}
          placeholder={t('shifts.allStatuses')}
          value={filters.status}
          onChange={(event) => update('status', event.target.value as CashShiftStatus | '')}
          options={CASH_SHIFT_STATUSES.map((status) => ({ value: status, label: t(`status:cashShift.${status}`) }))}
        />
        <Input
          type="date"
          aria-label={t('filters.from')}
          value={filters.from}
          onChange={(event) => update('from', event.target.value)}
        />
        <Input type="date" aria-label={t('filters.to')} value={filters.to} onChange={(event) => update('to', event.target.value)} />
      </Toolbar>
      <DataTable
        caption={t('shifts.title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(shift) => shift.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('shifts.empty')}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(shift) => setSelected(shift.id)}
        pagination={
          query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }
        }
      />
      {selected && <CashShiftDetailDrawer shiftId={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
