import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeatures, usePlans } from '@/entities/platform/platform.queries';
import type { FeatureDto, PlanDto } from '@/entities/platform/platform.types';
import { PlanFormModal } from '@/features/platform/ui/PlanFormModal';
import styles from '@/features/platform/ui/platform.module.css';
import { Button, Card, DataTable, IconButton, PageHeader, StatusBadge, type DataTableColumn } from '@/shared/ui';

/** Plans & limits, plus the feature catalog. */
export function PlansPage() {
  const { t } = useTranslation('platform');
  const plans = usePlans();
  const features = useFeatures();
  const [editing, setEditing] = useState<{ plan: PlanDto | null } | null>(null);
  const featureName = (code: string) => features.data?.find((feature) => feature.code === code)?.name ?? code;

  const columns: DataTableColumn<PlanDto>[] = [
    { key: 'name', header: t('fields.planName'), cell: (row) => (<><strong>{row.name}</strong><br /><small className={styles.mono}>{row.code}</small></>) },
    { key: 'branches', header: t('fields.maxBranches'), align: 'right', cell: (row) => row.maxBranches },
    { key: 'users', header: t('fields.maxUsers'), align: 'right', cell: (row) => row.maxUsers },
    { key: 'features', header: t('fields.features'), hideOnMobile: true, cell: (row) => row.features.map(featureName).join(', ') || '—' },
    {
      key: 'active',
      header: t('columns.status'),
      cell: (row) => <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? t('plans.active') : t('plans.inactive')}</StatusBadge>,
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">{t('columns.actions')}</span>,
      align: 'right',
      width: '56px',
      cell: (row) => <IconButton label={t('plans.edit', { name: row.name })} icon={<Pencil />} onClick={() => setEditing({ plan: row })} />,
    },
  ];
  const featureColumns: DataTableColumn<FeatureDto>[] = [
    { key: 'code', header: t('fields.featureCode'), cell: (row) => <span className={styles.mono}>{row.code}</span> },
    { key: 'name', header: t('fields.featureName'), cell: (row) => row.name },
  ];

  return (
    <>
      <PageHeader
        title={t('plans.title')}
        description={t('plans.subtitle')}
        actions={<Button variant="primary" icon={<Plus />} onClick={() => setEditing({ plan: null })}>{t('plans.create')}</Button>}
      />
      <DataTable
        caption={t('plans.title')}
        columns={columns}
        rows={plans.data}
        getRowId={(row) => row.id}
        isLoading={plans.isFetching}
        error={plans.error}
        onRetry={() => void plans.refetch()}
        emptyTitle={t('plans.empty')}
      />
      <Card title={t('plans.featuresTitle')} flush>
        <DataTable
          caption={t('plans.featuresTitle')}
          columns={featureColumns}
          rows={features.data}
          getRowId={(row) => row.code}
          isLoading={features.isFetching}
          error={features.error}
          onRetry={() => void features.refetch()}
        />
      </Card>
      <PlanFormModal target={editing} onClose={() => setEditing(null)} />
    </>
  );
}
