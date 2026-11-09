import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { usePermissionCatalog, useRoles, useSaveRole } from '@/entities/role/role.queries';
import { groupPermissions } from '@/features/roles/model/group-permissions';
import { PermissionChecklist } from '@/features/roles/ui/PermissionChecklist';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { requiredString } from '@/shared/lib/validation';
import { Alert, Button, Card, ErrorState, FormActions, FormField, FormGrid, Input, PageHeader, PageLoader, useToast } from '@/shared/ui';

const roleSchema = z.object({ name: requiredString(100), permissions: z.array(z.string()) });
type RoleValues = z.infer<typeof roleSchema>;

/** Create (`/admin/roles/new`) or edit (`/admin/roles/:roleId`) a role. System roles are read-only here. */
export function RoleEditorPage() {
  const { t } = useTranslation('roles');
  const { roleId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const roles = useRoles();
  const catalog = usePermissionCatalog();
  const save = useSaveRole();
  const [serverError, setServerError] = useState<string | null>(null);
  const role = roleId ? roles.data?.find((item) => item.id === roleId) : undefined;
  const readOnly = !hasPermission(PERMISSIONS.roles.manage) || Boolean(role?.isSystem);
  const groups = useMemo(() => groupPermissions(catalog.data), [catalog.data]);

  const { register, control, handleSubmit, reset, setError, formState } = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', permissions: [] },
  });

  useEffect(() => {
    if (role) reset({ name: role.name, permissions: role.permissions });
  }, [role, reset]);

  if (roleId && roles.isLoading) return <PageLoader />;
  if (roles.error) return <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />;
  if (roleId && !role) return <ErrorState title={t('notFound')} />;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({ id: roleId, input: values });
      toast.success(t(roleId ? 'toast.updated' : 'toast.created'));
      navigate(ROUTES.admin.roles);
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, ['name', 'permissions'])) setServerError(getErrorMessage(error, t));
    }
  });

  return (
    <>
      <PageHeader
        back={
          <Link to={ROUTES.admin.roles}>
            <ArrowLeft size={14} aria-hidden="true" /> {t('backToRoles')}
          </Link>
        }
        title={role ? role.name : t('newTitle')}
        description={role?.isSystem ? t('systemReadOnly') : t('editorSubtitle')}
      />
      <FormGrid onSubmit={onSubmit}>
        {serverError && <Alert>{serverError}</Alert>}
        <Card>
          <FormField label={t('fields.name')} error={formState.errors.name?.message} required>
            <Input disabled={readOnly} {...register('name')} />
          </FormField>
        </Card>
        {catalog.error && <Alert>{t('catalogFallback')}</Alert>}
        <Controller
          control={control}
          name="permissions"
          render={({ field }) => (
            <PermissionChecklist groups={groups} value={field.value} onChange={field.onChange} disabled={readOnly} />
          )}
        />
        {!readOnly && (
          <FormActions>
            <Button onClick={() => navigate(ROUTES.admin.roles)}>{t('common:actions.cancel')}</Button>
            <Button type="submit" variant="primary" loading={formState.isSubmitting}>
              {t('common:actions.save')}
            </Button>
          </FormActions>
        )}
      </FormGrid>
    </>
  );
}
