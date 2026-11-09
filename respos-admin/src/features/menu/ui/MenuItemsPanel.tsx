import { Archive, ImageOff, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKitchenStations } from '@/entities/kitchen-station/kitchen-station.queries';
import { useArchiveMenuItem, useMenuItems, useSetMenuItemAvailability } from '@/entities/menu/menu-item.queries';
import { useMenuCategories } from '@/entities/menu/menu.queries';
import type { MenuItemDto } from '@/entities/menu/menu.types';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  IconButton,
  SearchInput,
  Select,
  StatusBadge,
  Switch,
  Toolbar,
  useToast,
  type DataTableColumn,
} from '@/shared/ui';
import { MenuItemFormModal } from './MenuItemFormModal';
import styles from './MenuPanels.module.css';

type Availability = '' | 'available' | 'stopped';

export function MenuItemsPanel({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('menu');
  const toast = useToast();
  const format = useFormatters();
  const [searchText, setSearchText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [availability, setAvailability] = useState<Availability>('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MenuItemDto | null | 'new'>(null);
  const [archiving, setArchiving] = useState<MenuItemDto | null>(null);
  const search = useDebouncedValue(searchText.trim());
  const categories = useMenuCategories();
  const stations = useKitchenStations();
  const setAvailable = useSetMenuItemAvailability();
  const archive = useArchiveMenuItem();
  const query = useMenuItems({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    categoryId: categoryId || undefined,
    isAvailable: availability === '' ? undefined : availability === 'available',
    includeArchived: includeArchived || undefined,
    sort: 'name:asc',
  });
  const stationName = useMemo(() => new Map((stations.data ?? []).map((station) => [station.id, station.name])), [stations.data]);
  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const toggle = async (item: MenuItemDto, isAvailable: boolean) => {
    try {
      await setAvailable.mutateAsync({ id: item.id, isAvailable });
      toast.success(t(isAvailable ? 'toast.available' : 'toast.stopped', { name: item.name }));
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    }
  };

  const columns: DataTableColumn<MenuItemDto>[] = [
    {
      key: 'photo',
      header: <span className="visually-hidden">{t('columns.photo')}</span>,
      width: '60px',
      hideOnMobile: true,
      cell: (item) => (
        <span className={styles.thumb}>
          {item.photoUrl ? <img src={item.photoUrl} alt="" /> : <ImageOff aria-hidden="true" />}
        </span>
      ),
    },
    {
      key: 'name',
      header: t('columns.name'),
      cell: (item) => (
        <>
          <strong>{item.name}</strong>
          {item.isArchived && (
            <StatusBadge tone="neutral" size="sm" className={styles.archived}>
              {t('archived')}
            </StatusBadge>
          )}
          {item.nameUz && (
            <>
              <br />
              <small className={styles.muted}>{item.nameUz}</small>
            </>
          )}
          {item.variants.length > 0 && (
            <>
              <br />
              <small className={styles.muted}>
                {t('variantsShort', { names: item.variants.map((v) => v.name).join(' / ') })}
              </small>
            </>
          )}
        </>
      ),
    },
    { key: 'category', header: t('columns.category'), hideOnMobile: true, cell: (item) => item.categoryName },
    { key: 'price', header: t('columns.price'), align: 'right', cell: (item) => format.money(item.price) },
    {
      key: 'station',
      header: t('columns.station'),
      hideOnMobile: true,
      cell: (item) => (item.kitchenStationId ? (stationName.get(item.kitchenStationId) ?? '—') : t('itemForm.defaultStation')),
    },
    {
      key: 'available',
      header: t('columns.available'),
      cell: (item) =>
        canManage && !item.isArchived ? (
          <Switch
            checked={item.isAvailable}
            disabled={setAvailable.isPending && setAvailable.variables?.id === item.id}
            onChange={(checked) => void toggle(item, checked)}
            label={<span className="visually-hidden">{t('availabilityLabel', { name: item.name })}</span>}
          />
        ) : (
          <StatusBadge tone={item.isAvailable ? 'success' : 'danger'}>
            {t(item.isAvailable ? 'available' : 'stopped')}
          </StatusBadge>
        ),
    },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      header: <span className="visually-hidden">{t('columns.actions')}</span>,
      align: 'right',
      width: '112px',
      cell: (item) => (
        <>
          <IconButton label={t('actions.editNamed', { name: item.name })} icon={<Pencil />} onClick={() => setEditing(item)} />
          {!item.isArchived && (
            <IconButton
              label={t('actions.archiveNamed', { name: item.name })}
              icon={<Archive />}
              onClick={() => setArchiving(item)}
            />
          )}
        </>
      ),
    });
  }

  const doArchive = async () => {
    if (!archiving) return;
    try {
      await archive.mutateAsync(archiving.id);
      toast.success(t('toast.itemArchived'));
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    } finally {
      setArchiving(null);
    }
  };

  return (
    <>
      <Toolbar
        actions={
          canManage && (
            <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
              {t('actions.createItem')}
            </Button>
          )
        }
      >
        <SearchInput value={searchText} onChange={resetPage(setSearchText)} placeholder={t('searchPlaceholder')} />
        <Select
          aria-label={t('columns.category')}
          placeholder={t('filters.allCategories')}
          value={categoryId}
          onChange={(event) => resetPage(setCategoryId)(event.target.value)}
          options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
        />
        <Select
          aria-label={t('columns.available')}
          placeholder={t('filters.anyAvailability')}
          value={availability}
          onChange={(event) => resetPage(setAvailability)(event.target.value as Availability)}
          options={[
            { value: 'available', label: t('available') },
            { value: 'stopped', label: t('stopped') },
          ]}
        />
        <Checkbox
          label={t('filters.includeArchived')}
          checked={includeArchived}
          onChange={(event) => resetPage(setIncludeArchived)(event.target.checked)}
        />
      </Toolbar>
      <DataTable
        caption={t('tabs.items')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(item) => item.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('emptyItems')}
        pagination={
          query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }
        }
      />
      {editing && (
        <MenuItemFormModal
          item={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          defaultCategoryId={categoryId || undefined}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={archiving !== null}
        title={t('confirm.archiveItemTitle')}
        message={t('confirm.archiveItemMessage', { name: archiving?.name ?? '' })}
        confirmLabel={t('actions.archive')}
        loading={archive.isPending}
        onConfirm={() => void doArchive()}
        onCancel={() => setArchiving(null)}
      />
    </>
  );
}
