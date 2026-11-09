import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TableDto } from '@/entities/table/table.types';
import { TableRowActions } from '@/features/floor/ui/TableRowActions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DataTable, StatusBadge, type DataTableColumn } from '@/shared/ui';

export interface TablesListViewProps {
  tables: TableDto[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Present only with `tables.manage`. */
  onEdit?: (table: TableDto) => void;
}

export function TablesListView({ tables, isLoading, error, onRetry, onEdit }: TablesListViewProps) {
  const { t } = useTranslation('floor');
  const format = useFormatters();

  const columns = useMemo<DataTableColumn<TableDto>[]>(() => {
    const base: DataTableColumn<TableDto>[] = [
      { key: 'number', header: t('columns.number'), cell: (table) => <strong>{table.number}</strong> },
      { key: 'area', header: t('columns.area'), cell: (table) => table.areaName },
      { key: 'capacity', header: t('columns.capacity'), cell: (table) => table.capacity, align: 'right' },
      { key: 'status', header: t('columns.status'), cell: (table) => <StatusBadge domain="table" status={table.status} /> },
      {
        key: 'order',
        header: t('columns.order'),
        align: 'right',
        hideOnMobile: true,
        cell: (table) =>
          table.activeOrderTotal === null || table.activeOrderTotal === undefined ? '—' : format.money(table.activeOrderTotal),
      },
      {
        key: 'reservation',
        header: t('columns.reservation'),
        hideOnMobile: true,
        cell: (table) =>
          table.nextReservation ? `${format.time(table.nextReservation.startsAt)} · ${table.nextReservation.guestName}` : '—',
      },
      {
        key: 'active',
        header: t('columns.active'),
        hideOnMobile: true,
        cell: (table) => t(table.isActive ? 'active' : 'inactive'),
      },
    ];
    if (!onEdit) return base;
    return [
      ...base,
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '56px',
        cell: (table) => <TableRowActions table={table} onEdit={onEdit} />,
      },
    ];
  }, [t, format, onEdit]);

  return (
    <DataTable
      caption={t('tabs.list')}
      columns={columns}
      rows={tables}
      getRowId={(table) => table.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle={t('empty.noTables')}
    />
  );
}
