import { Archive, Ban, CheckCircle2, MoreHorizontal, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useArchiveTable, useSetTableStatus } from '@/entities/table/table.queries';
import type { TableDto } from '@/entities/table/table.types';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { ConfirmDialog, DropdownMenu, IconButton, useToast, type DropdownMenuItem } from '@/shared/ui';

export interface TableRowActionsProps {
  table: TableDto;
  onEdit: (table: TableDto) => void;
}

/** Edit / available ↔ unavailable / archive (confirmed). Caller renders it only with `tables.manage`. */
export function TableRowActions({ table, onEdit }: TableRowActionsProps) {
  const { t } = useTranslation('floor');
  const toast = useToast();
  const archive = useArchiveTable();
  const setStatus = useSetTableStatus();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const hasOrder = Boolean(table.activeOrderId);

  const changeStatus = async (status: 'available' | 'unavailable') => {
    try {
      await setStatus.mutateAsync({ id: table.id, status });
      toast.success(t('toast.statusChanged'));
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    }
  };

  const items: DropdownMenuItem[] = [{ id: 'edit', label: t('actions.edit'), icon: <Pencil />, onSelect: () => onEdit(table) }];
  if (table.status === 'available') {
    items.push({
      id: 'unavailable',
      label: t('actions.makeUnavailable'),
      icon: <Ban />,
      onSelect: () => void changeStatus('unavailable'),
    });
  }
  if (table.status === 'unavailable') {
    items.push({
      id: 'available',
      label: t('actions.makeAvailable'),
      icon: <CheckCircle2 />,
      onSelect: () => void changeStatus('available'),
    });
  }
  items.push({
    id: 'archive',
    label: hasOrder ? t('hasActiveOrder') : t('actions.archive'),
    icon: <Archive />,
    danger: true,
    disabled: hasOrder,
    onSelect: () => setConfirmArchive(true),
  });

  const doArchive = async () => {
    try {
      await archive.mutateAsync(table.id);
      toast.success(t('toast.tableArchived'));
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    } finally {
      setConfirmArchive(false);
    }
  };

  return (
    <span onClick={(event) => event.stopPropagation()}>
      <DropdownMenu
        items={items}
        trigger={(props) => (
          <IconButton label={t('actions.menu', { number: table.number })} icon={<MoreHorizontal />} {...props} />
        )}
      />
      <ConfirmDialog
        open={confirmArchive}
        title={t('confirm.archiveTableTitle')}
        message={t('confirm.archiveTableMessage', { number: table.number })}
        confirmLabel={t('actions.archive')}
        loading={archive.isPending}
        onConfirm={() => void doArchive()}
        onCancel={() => setConfirmArchive(false)}
      />
    </span>
  );
}
