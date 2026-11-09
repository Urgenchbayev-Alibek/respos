import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiningAreas } from '@/entities/dining-area/dining-area.queries';
import { useReservations } from '@/entities/reservation/reservation.queries';
import type { ReservationDto, ReservationInput } from '@/entities/reservation/reservation.types';
import { useTables } from '@/entities/table/table.queries';
import { findOverlapping } from '@/features/reservations/model/reservation-form';
import { ReservationDrawer } from '@/features/reservations/ui/ReservationDrawer';
import { ReservationFormModal } from '@/features/reservations/ui/ReservationFormModal';
import { ReservationTimeline } from '@/features/reservations/ui/ReservationTimeline';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { RESERVATION_STATUSES, type ReservationStatus } from '@/shared/constants/statuses';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { toBranchDateString } from '@/shared/lib/format-date';
import { addDaysToDateString } from '@/shared/lib/zoned-time';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/shared/types/pagination';
import { Button, ErrorState, IconButton, Input, PageHeader, SearchInput, Select, Skeleton, Tabs, Toolbar } from '@/shared/ui';
import { ReservationsList } from './ReservationsList';
import styles from './ReservationsPage.module.css';

type View = 'day' | 'list';

/** Reservations: day timeline (tables × hours) or paged list, with create/edit and status actions. */
export function ReservationsPage() {
  const { t } = useTranslation('reservations');
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.reservations.manage);
  const today = toBranchDateString(new Date(), format.timeZone);
  const [date, setDate] = useState(today);
  const [view, setView] = useState<View>('day');
  const [status, setStatus] = useState<ReservationStatus | ''>('');
  const [tableId, setTableId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ReservationDto | null | 'new'>(null);
  const [opened, setOpened] = useState<ReservationDto | null>(null);
  const [conflictIds, setConflictIds] = useState<ReadonlySet<string>>(new Set());
  const search = useDebouncedValue(searchText.trim());
  const tables = useTables();
  const areas = useDiningAreas();

  const query = useReservations({
    date,
    status: status || undefined,
    tableId: tableId || undefined,
    search: search || undefined,
    page: view === 'day' ? 1 : page,
    pageSize: view === 'day' ? MAX_PAGE_SIZE : DEFAULT_PAGE_SIZE,
    sort: 'startsAt:asc',
  });

  const tablesById = useMemo(() => new Map((tables.data ?? []).map((table) => [table.id, table])), [tables.data]);
  const tableLabel = useCallback(
    (reservation: ReservationDto) =>
      reservation.tableNumber ?? (reservation.tableId ? tablesById.get(reservation.tableId)?.number : undefined) ?? t('noTable'),
    [tablesById, t],
  );

  const resetPaging =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
      setConflictIds(new Set());
    };
  const changeDate = resetPaging(setDate);

  const onConflict = (input: ReservationInput) => {
    const editingId = modal && modal !== 'new' ? modal.id : undefined;
    const overlapping = findOverlapping(query.data?.items ?? [], { ...input, id: editingId });
    setConflictIds(new Set(overlapping.map((reservation) => reservation.id)));
  };

  const timelineTables = (tables.data ?? []).filter((table) => !tableId || table.id === tableId);

  const renderDay = () => {
    if (query.error && !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (!query.data || tables.isLoading) return <Skeleton height={240} radius="var(--radius-md)" />;
    return (
      <ReservationTimeline
        date={date}
        reservations={query.data.items}
        tables={timelineTables}
        highlightIds={conflictIds}
        onSelect={setOpened}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage && (
            <Button variant="primary" icon={<Plus />} onClick={() => setModal('new')}>
              {t('actions.create')}
            </Button>
          )
        }
      />
      <div className={styles.dateBar}>
        <IconButton
          label={t('prevDay')}
          icon={<ChevronLeft />}
          variant="secondary"
          onClick={() => changeDate(addDaysToDateString(date, -1))}
        />
        <Input
          type="date"
          className={styles.dateInput}
          aria-label={t('fields.date')}
          value={date}
          onChange={(event) => event.target.value && changeDate(event.target.value)}
        />
        <IconButton
          label={t('nextDay')}
          icon={<ChevronRight />}
          variant="secondary"
          onClick={() => changeDate(addDaysToDateString(date, 1))}
        />
        <Button disabled={date === today} onClick={() => changeDate(today)}>
          {t('today')}
        </Button>
      </div>
      <Tabs
        ariaLabel={t('views.label')}
        value={view}
        onChange={(id) => setView(id as View)}
        items={[
          { id: 'day', label: t('views.day') },
          { id: 'list', label: t('views.list') },
        ]}
      />
      <Toolbar>
        <SearchInput value={searchText} onChange={resetPaging(setSearchText)} placeholder={t('searchPlaceholder')} />
        <Select
          aria-label={t('columns.status')}
          placeholder={t('filters.allStatuses')}
          value={status}
          onChange={(event) => resetPaging(setStatus)(event.target.value as ReservationStatus | '')}
          options={RESERVATION_STATUSES.map((value) => ({ value, label: t(`status:reservation.${value}`) }))}
        />
        <Select
          aria-label={t('columns.table')}
          placeholder={t('filters.allTables')}
          value={tableId}
          onChange={(event) => resetPaging(setTableId)(event.target.value)}
          options={(tables.data ?? []).map((table) => ({ value: table.id, label: table.number }))}
        />
      </Toolbar>
      {view === 'day' ? (
        renderDay()
      ) : (
        <ReservationsList
          rows={query.data?.items}
          isLoading={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          tableLabel={tableLabel}
          highlightIds={conflictIds}
          onOpen={setOpened}
          onEdit={setModal}
          pagination={
            query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }
          }
        />
      )}
      {opened && (
        <ReservationDrawer
          reservation={opened}
          tableLabel={tableLabel(opened)}
          onEdit={setModal}
          onClose={() => setOpened(null)}
        />
      )}
      {modal && (
        <ReservationFormModal
          reservation={modal === 'new' ? null : modal}
          date={date}
          tables={tables.data ?? []}
          areas={areas.data ?? []}
          onConflict={onConflict}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
