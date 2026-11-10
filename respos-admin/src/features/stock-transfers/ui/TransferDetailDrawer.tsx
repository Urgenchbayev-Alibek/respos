import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReceiveStockTransfer, useStockTransfer, useStockTransferAction } from '@/entities/stock-transfer/stock-transfer.queries';
import { TRANSFER_STATUS_TONES, type StockTransferDto } from '@/entities/stock-transfer/stock-transfer.types';
import { useIdempotencyKey } from '@/shared/api/idempotency';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, ConfirmDialog, Drawer, ErrorState, Spinner, StatusBadge, useToast } from '@/shared/ui';
import styles from '@/features/stock/ui/stock.module.css';
import { TransferFormModal } from './TransferFormModal';

export interface TransferDetailDrawerProps {
  transferId: string | null;
  onClose: () => void;
}

/** Transfer card: lines + the actions allowed for the current side (source: edit/send/cancel, destination: receive). */
export function TransferDetailDrawer({ transferId, onClose }: TransferDetailDrawerProps) {
  const { t } = useTranslation('transfers');
  const toast = useToast();
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const query = useStockTransfer(transferId ?? undefined);
  const action = useStockTransferAction();
  const receive = useReceiveStockTransfer();
  const receiveKey = useIdempotencyKey();
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const canManage = hasPermission(PERMISSIONS.inventory.transfer);
  const transfer = query.data;

  const run = async (kind: 'send' | 'cancel' | 'receive', current: StockTransferDto) => {
    try {
      if (kind === 'receive') {
        await receive.mutateAsync({
          id: current.id,
          idempotencyKey: receiveKey.key,
        });
        receiveKey.renew();
      } else {
        await action.mutateAsync({ id: current.id, action: kind });
      }
      toast.success(t(`toast.${kind}`));
      setConfirmCancel(false);
    } catch (error) {
      toast.error(t('toast.failed'), getErrorMessage(error, t));
    }
  };

  const outgoing = transfer?.direction === 'outgoing';
  const footer = transfer && canManage && (
    <>
      {outgoing && transfer.status === 'draft' && <Button onClick={() => setEditing(true)}>{t('actions.edit')}</Button>}
      {outgoing && (transfer.status === 'draft' || transfer.status === 'sent') && (
        <Button variant="danger" onClick={() => setConfirmCancel(true)}>
          {t('actions.cancel')}
        </Button>
      )}
      {outgoing && transfer.status === 'draft' && (
        <Button variant="primary" loading={action.isPending} onClick={() => void run('send', transfer)}>
          {t('actions.send')}
        </Button>
      )}
      {!outgoing && transfer.status === 'sent' && (
        <Button variant="primary" loading={receive.isPending} onClick={() => void run('receive', transfer)}>
          {t('actions.receive')}
        </Button>
      )}
    </>
  );

  return (
    <Drawer
      open={Boolean(transferId)}
      onClose={onClose}
      width={560}
      title={transfer ? t('detail.title', { number: transfer.number }) : t('title')}
      footer={footer || undefined}
    >
      {query.isLoading && <Spinner />}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {transfer && (
        <div className={styles.stack}>
          <div>
            <StatusBadge tone={TRANSFER_STATUS_TONES[transfer.status]}>{t(`status.${transfer.status}`)}</StatusBadge>
          </div>
          <dl className={styles.stack}>
            <div>
              <dt>{t('fields.from')}</dt>
              <dd>{transfer.fromBranchName}</dd>
            </div>
            <div>
              <dt>{t('fields.to')}</dt>
              <dd>{transfer.toBranchName}</dd>
            </div>
            <div>
              <dt>{t('columns.createdAt')}</dt>
              <dd>{format.dateTime(transfer.createdAt)}</dd>
            </div>
            {transfer.sentAt && (
              <div>
                <dt>{t('columns.sentAt')}</dt>
                <dd>{format.dateTime(transfer.sentAt)}</dd>
              </div>
            )}
            {transfer.receivedAt && (
              <div>
                <dt>{t('columns.receivedAt')}</dt>
                <dd>{format.dateTime(transfer.receivedAt)}</dd>
              </div>
            )}
            {transfer.comment && (
              <div>
                <dt>{t('fields.comment')}</dt>
                <dd>{transfer.comment}</dd>
              </div>
            )}
          </dl>
          {transfer.status === 'draft' && <p className={styles.hint}>{t('detail.draftHint')}</p>}
          <div className={styles.linesScroll}>
            <table className={styles.linesTable}>
              <caption className="visually-hidden">{t('detail.lines')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('columns.ingredient')}</th>
                  <th scope="col">{t('columns.quantity')}</th>
                  <th scope="col">{t('columns.unitCost')}</th>
                </tr>
              </thead>
              <tbody>
                {transfer.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.ingredientName}</td>
                    <td>
                      {format.number(line.quantity)} {line.unitCode}
                    </td>
                    <td>{line.unitCost === null ? '—' : `${format.money(line.unitCost)} / ${line.baseUnitCode}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong>{t('columns.totalCost')}:</strong> {format.money(transfer.totalCost)}
          </p>
        </div>
      )}
      <TransferFormModal open={editing} transfer={transfer} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={confirmCancel}
        title={t('confirmCancel.title')}
        message={transfer?.status === 'sent' ? t('confirmCancel.sentMessage') : t('confirmCancel.message')}
        confirmLabel={t('actions.cancel')}
        loading={action.isPending}
        onConfirm={() => transfer && void run('cancel', transfer)}
        onCancel={() => setConfirmCancel(false)}
      />
    </Drawer>
  );
}
