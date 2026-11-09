import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags, useFeatures, usePlatformOrganizations, useSetFeatureFlag } from '@/entities/platform/platform.queries';
import type { FeatureDto } from '@/entities/platform/platform.types';
import styles from '@/features/platform/ui/platform.module.css';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { MAX_PAGE_SIZE } from '@/shared/types/pagination';
import { DataTable, PageHeader, Select, StatusBadge, Switch, Toolbar, useToast, type DataTableColumn } from '@/shared/ui';

/** Feature flags: global (organizationId = null) or per organization override. */
export function FeatureFlagsPage() {
  const { t } = useTranslation('platform');
  const toast = useToast();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const organizations = usePlatformOrganizations({ page: 1, pageSize: MAX_PAGE_SIZE, sort: 'name:asc' });
  const features = useFeatures();
  const flags = useFeatureFlags(organizationId);
  const setFlag = useSetFeatureFlag();

  const flagFor = (code: string) =>
    flags.data?.find((flag) => flag.featureCode === code && (flag.organizationId ?? null) === organizationId);

  const toggle = async (featureCode: string, isEnabled: boolean) => {
    try {
      await setFlag.mutateAsync({ organizationId, featureCode, isEnabled });
      toast.success(t('flags.saved'));
    } catch (error) {
      toast.error(t('flags.saveFailed'), getErrorMessage(error, t));
    }
  };

  const columns: DataTableColumn<FeatureDto>[] = [
    { key: 'name', header: t('fields.featureName'), cell: (row) => (<><strong>{row.name}</strong><br /><small className={styles.mono}>{row.code}</small></>) },
    {
      key: 'source',
      header: t('flags.source'),
      cell: (row) => (flagFor(row.code) ? <StatusBadge tone="info">{t('flags.explicit')}</StatusBadge> : <StatusBadge tone="neutral">{t('flags.default')}</StatusBadge>),
    },
    {
      key: 'enabled',
      header: t('flags.enabled'),
      align: 'right',
      cell: (row) => (
        <Switch
          checked={flagFor(row.code)?.isEnabled ?? false}
          disabled={setFlag.isPending || flags.isFetching}
          onChange={(checked) => void toggle(row.code, checked)}
          label={<span className="visually-hidden">{t('flags.toggle', { name: row.name })}</span>}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('flags.title')} description={t('flags.subtitle')} />
      <Toolbar>
        <Select
          aria-label={t('flags.scope')}
          placeholder={t('flags.global')}
          value={organizationId ?? ''}
          onChange={(event) => setOrganizationId(event.target.value || null)}
          options={(organizations.data?.items ?? []).map((org) => ({ value: org.id, label: org.name }))}
        />
      </Toolbar>
      <DataTable
        caption={t('flags.title')}
        columns={columns}
        rows={features.data}
        getRowId={(row) => row.code}
        isLoading={features.isFetching}
        error={features.error ?? flags.error}
        onRetry={() => void Promise.all([features.refetch(), flags.refetch()])}
        emptyTitle={t('flags.empty')}
      />
    </>
  );
}
