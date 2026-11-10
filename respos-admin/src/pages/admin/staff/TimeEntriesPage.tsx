import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStaffMembers, useTimeEntries } from '@/entities/staff/staff.queries';
import type { TimeEntryDto } from '@/entities/staff/staff.types';
import { formatMinutes } from '@/features/staff/model/staff-errors';
import { TimeEntryFormModal } from '@/features/staff/ui/TimeEntryFormModal';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { Button, Checkbox, DataTable, Input, PageHeader, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';
import { StaffTabs } from './StaffTabs';

interface Filters {
  userId: string;
  from: string;
  to: string;
  openOnly: boolean;
}

/** Admin → Staff → time entries: filters, manual entry, audited corrections. */
export function TimeEntriesPage() {
  const { t } = useTranslation('staff');
  const format = useFormatters();
  const [filters, setFilters] = useState<Filters>({ userId: '', from: '', to: '', openOnly: false });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TimeEntryDto | 'new' | null>(null);
  const members = useStaffMembers();
  const query = useTimeEntries({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    userId: filters.userId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    openOnly: filters.openOnly || undefined,
  });
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const columns = useMemo<DataTableColumn<TimeEntryDto>[]>(
    () => [
      { key: 'user', header: t('fields.employee'), cell: (entry) => entry.userName ?? '—' },
      { key: 'in', header: t('fields.clockIn'), cell: (entry) => format.dateTime(entry.clockInAt) },
      {
        key: 'out',
        header: t('fields.clockOut'),
        cell: (entry) => (entry.clockOutAt ? format.dateTime(entry.clockOutAt) : <StatusBadge tone="success">{t('entries.open')}</StatusBadge>),
      },
      { key: 'break', header: t('fields.breakMinutes'), align: 'right', hideOnMobile: true, cell: (entry) => entry.breakMinutes },
      { key: 'worked', header: t('fields.worked'), align: 'right', cell: (entry) => formatMinutes(entry.workedMinutes) },
      {
        key: 'edited',
        header: t('fields.edited'),
        hideOnMobile: true,
        cell: (entry) => (entry.editedAt ? `${entry.editedByName ?? '—'}: ${entry.editReason ?? ''}` : '—'),
      },
    ],
    [t, format],
  );

  return (
    <>
      <PageHeader
        title={t('nav.title')}
        description={t('entries.subtitle')}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
            {t('entries.add')}
          </Button>
        }
      />
      <StaffTabs />
      <Toolbar>
        <Select
          aria-label={t('fields.employee')}
          placeholder={t('fields.allEmployees')}
          value={filters.userId}
          onChange={(event) => update('userId', event.target.value)}
          options={(members.data ?? []).map((member) => ({ value: member.userId, label: member.fullName }))}
        />
        <Input type="date" aria-label={t('fields.from')} value={filters.from} onChange={(event) => update('from', event.target.value)} />
        <Input type="date" aria-label={t('fields.to')} value={filters.to} onChange={(event) => update('to', event.target.value)} />
        <Checkbox label={t('entries.openOnly')} checked={filters.openOnly} onChange={(event) => update('openOnly', event.target.checked)} />
      </Toolbar>
      <DataTable
        caption={t('tabs.entries')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(entry) => entry.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('entries.empty')}
        onRowClick={(entry) => setEditing(entry)}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      {editing && (
        <TimeEntryFormModal entry={editing === 'new' ? null : editing} members={members.data ?? []} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
