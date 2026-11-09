import { Archive, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useArchiveSupplier, useSuppliers } from '@/entities/supplier/supplier.queries';
import type { SupplierDto } from '@/entities/supplier/supplier.types';
import { SupplierFormModal } from '@/features/suppliers/ui/SupplierFormModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { DEFAULT_PAGE_SIZE, toSortParam, type SortState } from '@/shared/types/pagination';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  IconButton,
  PageHeader,
  SearchInput,
  StatusBadge,
  Toolbar,
  useToast,
  type DataTableColumn,
} from '@/shared/ui';

export function SuppliersPage() {
  const { t } = useTranslation('suppliers');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.suppliers.manage);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ field: 'name', direction: 'asc' });
  const [editing, setEditing] = useState<{ supplier: SupplierDto | null } | null>(null);
  const [archiving, setArchiving] = useState<SupplierDto | null>(null);
  const debounced = useDebouncedValue(search.trim());
  const archive = useArchiveSupplier();
  const query = useSuppliers({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: toSortParam(sort),
    search: debounced || undefined,
    includeArchived: includeArchived || undefined,
  });

  const confirmArchive = async () => {
    if (!archiving) return;
    try {
      await archive.mutateAsync(archiving.id);
      toast.success(t('toast.archived'));
    } catch (error) {
      toast.error(t('toast.archiveFailed'), getErrorMessage(error, t));
    } finally {
      setArchiving(null);
    }
  };

  const columns = useMemo<DataTableColumn<SupplierDto>[]>(
    () => [
      { key: 'name', header: t('fields.name'), sortField: 'name', cell: (row) => <strong>{row.name}</strong> },
      { key: 'contact', header: t('fields.contactPerson'), hideOnMobile: true, cell: (row) => row.contactPerson ?? '—' },
      { key: 'phone', header: t('fields.phone'), cell: (row) => row.phone ?? '—' },
      { key: 'email', header: t('fields.email'), hideOnMobile: true, cell: (row) => row.email ?? '—' },
      { key: 'inn', header: t('fields.inn'), hideOnMobile: true, cell: (row) => row.inn ?? '—' },
      {
        key: 'status',
        header: t('columns.status'),
        cell: (row) =>
          row.isArchived ? <StatusBadge tone="neutral">{t('archived')}</StatusBadge> : <StatusBadge tone="success">{t('active')}</StatusBadge>,
      },
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '112px',
        cell: (row) =>
          canManage && (
            <>
              <IconButton label={t('actions.edit', { name: row.name })} icon={<Pencil />} onClick={() => setEditing({ supplier: row })} />
              {!row.isArchived && (
                <IconButton label={t('actions.archive', { name: row.name })} icon={<Archive />} onClick={() => setArchiving(row)} />
              )}
            </>
          ),
      },
    ],
    [t, canManage],
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={canManage && <Button variant="primary" icon={<Plus />} onClick={() => setEditing({ supplier: null })}>{t('actions.create')}</Button>}
      />
      <Toolbar>
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('search')} />
        <Checkbox label={t('showArchived')} checked={includeArchived} onChange={(event) => { setIncludeArchived(event.target.checked); setPage(1); }} />
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
        sort={sort}
        onSortChange={setSort}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      <SupplierFormModal target={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={archiving !== null}
        title={t('confirm.archiveTitle')}
        message={t('confirm.archiveMessage', { name: archiving?.name ?? '' })}
        confirmLabel={t('actions.archiveShort')}
        loading={archive.isPending}
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiving(null)}
      />
    </>
  );
}
