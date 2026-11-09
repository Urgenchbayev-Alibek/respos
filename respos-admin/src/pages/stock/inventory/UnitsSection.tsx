import { ArrowRightLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnits } from '@/entities/unit/unit.queries';
import type { UnitDto } from '@/entities/unit/unit.types';
import { ConversionFormModal, UnitFormModal } from '@/features/stock/ui/UnitModals';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { Button, DataTable, Toolbar, type DataTableColumn } from '@/shared/ui';

/** Units of measure (org-level) and conversions between them. */
export function UnitsSection() {
  const { t } = useTranslation('stock');
  const { hasPermission } = usePermissions();
  const units = useUnits();
  const [modal, setModal] = useState<'unit' | 'conversion' | null>(null);
  const columns: DataTableColumn<UnitDto>[] = [
    { key: 'code', header: t('fields.unitCode'), cell: (row) => <strong>{row.code}</strong> },
    { key: 'name', header: t('fields.name'), cell: (row) => row.name },
    { key: 'kind', header: t('fields.unitKind'), cell: (row) => t(`unitKind.${row.kind}`, { defaultValue: row.kind }) },
  ];

  return (
    <>
      <Toolbar
        actions={
          hasPermission(PERMISSIONS.inventory.manage) && (
            <>
              <Button icon={<ArrowRightLeft />} onClick={() => setModal('conversion')}>{t('units.addConversion')}</Button>
              <Button variant="primary" icon={<Plus />} onClick={() => setModal('unit')}>{t('units.add')}</Button>
            </>
          )
        }
      >
        <p>{t('units.description')}</p>
      </Toolbar>
      <DataTable
        caption={t('tabs.units')}
        columns={columns}
        rows={units.data}
        getRowId={(row) => row.id}
        isLoading={units.isFetching}
        error={units.error}
        onRetry={() => void units.refetch()}
        emptyTitle={t('units.empty')}
      />
      <UnitFormModal open={modal === 'unit'} onClose={() => setModal(null)} />
      <ConversionFormModal open={modal === 'conversion'} onClose={() => setModal(null)} />
    </>
  );
}
