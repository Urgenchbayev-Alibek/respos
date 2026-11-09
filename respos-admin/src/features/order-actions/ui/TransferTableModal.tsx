import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransferOrder } from '@/entities/order/order.queries';
import { formatOrderNumber, type OrderDto } from '@/entities/order/order.types';
import { useTables } from '@/entities/table/table.queries';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, EmptyState, ErrorState, FormField, Modal, Select, Skeleton, useToast } from '@/shared/ui';
import { transferTargets } from '../model/transfer-targets';

/** Move a dine-in order to another table (orders.transfer). */
export function TransferTableModal({ order, onClose }: { order: OrderDto; onClose: () => void }) {
  const { t } = useTranslation('orderActions');
  const toast = useToast();
  const tables = useTables();
  const transfer = useTransferOrder();
  const [tableId, setTableId] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const targets = tables.data ? transferTargets(tables.data, order.tableId) : [];

  const submit = async () => {
    setServerError(null);
    try {
      const moved = await transfer.mutateAsync({ orderId: order.id, tableId });
      toast.success(t('transfer.done', { number: moved.tableNumber ?? '—' }));
      onClose();
    } catch (error) {
      setServerError(getErrorMessage(error, t));
      void tables.refetch();
    }
  };

  const renderBody = () => {
    if (tables.error && !tables.data) return <ErrorState error={tables.error} onRetry={() => void tables.refetch()} />;
    if (!tables.data) return <Skeleton height={44} />;
    if (targets.length === 0) return <EmptyState title={t('transfer.noTables')} />;
    return (
      <FormField label={t('transfer.table')} required>
        <Select
          data-autofocus
          value={tableId}
          onChange={(event) => setTableId(event.target.value)}
          placeholder={t('transfer.placeholder')}
          options={targets.map((table) => ({
            value: table.id,
            label: t('transfer.option', { number: table.number, area: table.areaName, capacity: table.capacity }),
          }))}
        />
      </FormField>
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('transfer.title', { number: formatOrderNumber(order.number) })}
      description={order.tableNumber ? t('transfer.description', { number: order.tableNumber }) : undefined}
      dismissible={!transfer.isPending}
      footer={
        <>
          <Button onClick={onClose} disabled={transfer.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="primary" loading={transfer.isPending} disabled={!tableId} onClick={() => void submit()}>
            {t('transfer.submit')}
          </Button>
        </>
      }
    >
      {serverError && <Alert>{serverError}</Alert>}
      {renderBody()}
    </Modal>
  );
}
