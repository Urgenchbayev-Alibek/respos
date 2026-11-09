import { MoreHorizontal, Pencil, Plus, Power, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBranches, useDeactivateBranch } from '@/entities/branch/branch.queries';
import type { BranchDto } from '@/entities/branch/branch.types';
import { BranchFormModal } from '@/features/branches/ui/BranchFormModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { buildPath, ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import {
  Button,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  IconButton,
  PageHeader,
  StatusBadge,
  useToast,
  type DataTableColumn,
  type DropdownMenuItem,
} from '@/shared/ui';

export function BranchesPage() {
  const { t } = useTranslation('branches');
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.branches.manage);
  const canSettings = hasPermission(PERMISSIONS.settings.manage);
  const branches = useBranches();
  const deactivate = useDeactivateBranch();
  const [editing, setEditing] = useState<BranchDto | null | 'new'>(null);
  const [toDeactivate, setToDeactivate] = useState<BranchDto | null>(null);

  const columns = useMemo<DataTableColumn<BranchDto>[]>(() => {
    const menuItems = (branch: BranchDto): DropdownMenuItem[] => {
      const items: DropdownMenuItem[] = [];
      if (canManage) items.push({ id: 'edit', label: t('actions.edit'), icon: <Pencil />, onSelect: () => setEditing(branch) });
      if (canSettings) {
        items.push({
          id: 'settings',
          label: t('actions.settings'),
          icon: <Settings2 />,
          onSelect: () => navigate(buildPath(ROUTES.admin.branchSettings, { branchId: branch.id })),
        });
      }
      if (canManage && branch.isActive) {
        items.push({ id: 'deactivate', label: t('actions.deactivate'), icon: <Power />, danger: true, onSelect: () => setToDeactivate(branch) });
      }
      return items;
    };
    return [
      { key: 'name', header: t('columns.name'), cell: (branch) => <strong>{branch.name}</strong> },
      { key: 'address', header: t('columns.address'), hideOnMobile: true, cell: (branch) => branch.address || '—' },
      { key: 'phone', header: t('columns.phone'), hideOnMobile: true, cell: (branch) => branch.phone || '—' },
      { key: 'timezone', header: t('columns.timezone'), hideOnMobile: true, cell: (branch) => branch.timezone },
      {
        key: 'status',
        header: t('columns.status'),
        cell: (branch) => (
          <StatusBadge tone={branch.isActive ? 'success' : 'neutral'}>{t(branch.isActive ? 'active' : 'inactive')}</StatusBadge>
        ),
      },
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '56px',
        cell: (branch) => {
          const items = menuItems(branch);
          return items.length > 0 ? (
            <DropdownMenu items={items} trigger={(props) => <IconButton label={t('actions.menu', { name: branch.name })} icon={<MoreHorizontal />} {...props} />} />
          ) : null;
        },
      },
    ];
  }, [t, canManage, canSettings, navigate]);

  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    try {
      await deactivate.mutateAsync(toDeactivate.id);
      toast.success(t('toast.deactivated'));
    } catch (error) {
      toast.error(t('toast.deactivateFailed'), getErrorMessage(error, t));
    } finally {
      setToDeactivate(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage && (
            <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
              {t('create')}
            </Button>
          )
        }
      />
      <DataTable
        caption={t('title')}
        columns={columns}
        rows={branches.data}
        getRowId={(branch) => branch.id}
        isLoading={branches.isLoading}
        error={branches.error}
        onRetry={() => void branches.refetch()}
        emptyTitle={t('empty')}
      />
      {editing && <BranchFormModal branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={toDeactivate !== null}
        title={t('confirmDeactivateTitle')}
        message={t('confirmDeactivateMessage', { name: toDeactivate?.name ?? '' })}
        confirmLabel={t('actions.deactivate')}
        loading={deactivate.isPending}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setToDeactivate(null)}
      />
    </>
  );
}
