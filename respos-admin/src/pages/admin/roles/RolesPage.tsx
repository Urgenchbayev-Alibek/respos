import { Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDeleteRole, useRoles } from '@/entities/role/role.queries';
import type { RoleDto } from '@/entities/role/role.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { buildPath, ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, DataTable, IconButton, PageHeader, StatusBadge, useToast, type DataTableColumn } from '@/shared/ui';
import { UsersRolesTabs } from '../users/UsersRolesTabs';

export function RolesPage() {
  const { t } = useTranslation('roles');
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.roles.manage);
  const roles = useRoles();
  const deleteRole = useDeleteRole();
  const [toDelete, setToDelete] = useState<RoleDto | null>(null);

  const columns = useMemo<DataTableColumn<RoleDto>[]>(
    () => [
      {
        key: 'name',
        header: t('columns.name'),
        cell: (role) => (
          <>
            <strong>{role.name}</strong> {role.isSystem && <Lock aria-label={t('system')} size={14} />}
            <br />
            <small>{role.code}</small>
          </>
        ),
      },
      {
        key: 'type',
        header: t('columns.type'),
        cell: (role) => <StatusBadge tone={role.isSystem ? 'info' : 'neutral'}>{role.isSystem ? t('system') : t('custom')}</StatusBadge>,
      },
      { key: 'permissions', header: t('columns.permissions'), align: 'right', cell: (role) => role.permissions.length },
      { key: 'users', header: t('columns.users'), align: 'right', cell: (role) => role.userCount },
      {
        key: 'actions',
        header: <span className="visually-hidden">{t('columns.actions')}</span>,
        align: 'right',
        width: '56px',
        cell: (role) =>
          canManage && !role.isSystem && role.userCount === 0 ? (
            <IconButton
              label={t('delete', { name: role.name })}
              icon={<Trash2 />}
              onClick={(event) => {
                event.stopPropagation();
                setToDelete(role);
              }}
            />
          ) : null,
      },
    ],
    [t, canManage],
  );

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteRole.mutateAsync(toDelete.id);
      toast.success(t('toast.deleted'));
    } catch (error) {
      toast.error(t('toast.deleteFailed'), getErrorMessage(error, t));
    } finally {
      setToDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          canManage && (
            <Button variant="primary" icon={<Plus />} onClick={() => navigate(ROUTES.admin.roleNew)}>
              {t('create')}
            </Button>
          )
        }
      />
      <UsersRolesTabs />
      <DataTable
        caption={t('title')}
        columns={columns}
        rows={roles.data}
        getRowId={(role) => role.id}
        isLoading={roles.isLoading}
        error={roles.error}
        onRetry={() => void roles.refetch()}
        onRowClick={(role) => navigate(buildPath(ROUTES.admin.roleEdit, { roleId: role.id }))}
        emptyTitle={t('empty')}
      />
      <ConfirmDialog
        open={toDelete !== null}
        title={t('confirmDeleteTitle')}
        message={t('confirmDeleteMessage', { name: toDelete?.name ?? '' })}
        confirmLabel={t('common:actions.delete')}
        loading={deleteRole.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
