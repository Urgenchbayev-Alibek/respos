import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExportTimesheet, useTimesheet } from '@/entities/staff/staff.queries';
import type { TimesheetRowDto } from '@/entities/staff/staff.types';
import { formatMinutes, staffErrorMessage } from '@/features/staff/model/staff-errors';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { toBranchDateString } from '@/shared/lib/format-date';
import { addDaysToDateString } from '@/shared/lib/zoned-time';
import { Button, DataTable, Input, PageHeader, StatCard, Toolbar, useToast, type DataTableColumn } from '@/shared/ui';
import { StaffTabs } from './StaffTabs';
import { weekStart } from './week';

/** Admin → Staff → timesheet: planned vs worked hours per employee for a period (branch dates), CSV export. */
export function TimesheetPage() {
  const { t } = useTranslation('staff');
  const toast = useToast();
  const { branch } = useCurrentBranch();
  const today = toBranchDateString(new Date(), branch?.timezone);
  const [range, setRange] = useState(() => ({ from: weekStart(today), to: addDaysToDateString(weekStart(today), 6) }));
  const valid = Boolean(range.from && range.to && range.from <= range.to);
  const sheet = useTimesheet(range, valid);
  const exporter = useExportTimesheet();

  const columns = useMemo<DataTableColumn<TimesheetRowDto>[]>(
    () => [
      { key: 'name', header: t('fields.employee'), cell: (row) => row.fullName ?? '—' },
      { key: 'planned', header: t('fields.planned'), align: 'right', cell: (row) => formatMinutes(row.plannedMinutes) },
      { key: 'worked', header: t('fields.worked'), align: 'right', cell: (row) => formatMinutes(row.workedMinutes) },
      {
        key: 'diff',
        header: t('fields.difference'),
        align: 'right',
        cell: (row) => formatMinutes(row.workedMinutes - row.plannedMinutes),
      },
      { key: 'entries', header: t('fields.entries'), align: 'right', hideOnMobile: true, cell: (row) => row.entries },
      { key: 'open', header: t('entries.open'), hideOnMobile: true, cell: (row) => (row.hasOpenEntry ? t('timesheet.yes') : '—') },
    ],
    [t],
  );

  const runExport = async () => {
    try {
      await exporter.mutateAsync(range);
    } catch (error) {
      toast.error(staffErrorMessage(error, t));
    }
  };

  return (
    <>
      <PageHeader
        title={t('nav.title')}
        description={t('timesheet.subtitle')}
        actions={
          <Button icon={<Download />} loading={exporter.isPending} disabled={!valid} onClick={() => void runExport()}>
            {t('timesheet.export')}
          </Button>
        }
      />
      <StaffTabs />
      <Toolbar>
        <Input type="date" aria-label={t('fields.from')} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        <Input type="date" aria-label={t('fields.to')} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
      </Toolbar>
      {sheet.data && (
        <Toolbar>
          <StatCard label={t('fields.planned')} value={formatMinutes(sheet.data.totalPlannedMinutes)} />
          <StatCard label={t('fields.worked')} value={formatMinutes(sheet.data.totalWorkedMinutes)} />
        </Toolbar>
      )}
      <DataTable
        caption={t('tabs.timesheet')}
        columns={columns}
        rows={sheet.data?.rows}
        getRowId={(row) => row.userId}
        isLoading={sheet.isFetching}
        error={sheet.error}
        onRetry={() => void sheet.refetch()}
        emptyTitle={t('timesheet.empty')}
      />
    </>
  );
}
