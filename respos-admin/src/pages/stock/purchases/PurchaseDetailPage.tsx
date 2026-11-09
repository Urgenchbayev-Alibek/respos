import { ArrowLeft, Ban, PackageCheck, Pencil, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { usePurchase, usePurchaseAction } from '@/entities/purchase/purchase.queries';
import type { PurchaseAction, PurchaseItemDto } from '@/entities/purchase/purchase.types';
import { PurchaseFormModal } from '@/features/purchases/ui/PurchaseFormModal';
import { ReceivePurchaseModal } from '@/features/purchases/ui/ReceivePurchaseModal';
import styles from '@/features/stock/ui/stock.module.css';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  ErrorState,
  PageHeader,
  PageLoader,
  StatusBadge,
  useToast,
  type DataTableColumn,
} from '@/shared/ui';

/** Purchase document: lines with received progress; submit / cancel / receive by status. */
export function PurchaseDetailPage() {
  const { t } = useTranslation('purchases');
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const toast = useToast();
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const query = usePurchase(purchaseId);
  const action = usePurchaseAction();
  const [editing, setEditing] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [pending, setPending] = useState<PurchaseAction | null>(null);
  const purchase = query.data;

  const back = (
    <Link to=".." relative="path">
      <ArrowLeft aria-hidden="true" size={14} /> {t('backToList')}
    </Link>
  );

  if (query.isLoading) return <PageLoader />;
  if (query.error || !purchase) {
    return (
      <>
        <PageHeader title={t('title')} back={back} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const canManage = hasPermission(PERMISSIONS.purchases.manage);
  const canReceive = hasPermission(PERMISSIONS.purchases.receive);
  const isDraft = purchase.status === 'draft';
  const receivable = purchase.status === 'submitted' || purchase.status === 'partially_received';
  const cancellable = canManage && (isDraft || purchase.status === 'submitted');

  const run = async () => {
    if (!pending) return;
    try {
      await action.mutateAsync({ id: purchase.id, action: pending });
      toast.success(t(`toast.${pending}`));
    } catch (error) {
      toast.error(t('toast.actionFailed'), getErrorMessage(error, t));
    } finally {
      setPending(null);
    }
  };

  const columns: DataTableColumn<PurchaseItemDto>[] = [
    { key: 'ingredient', header: t('columns.ingredient'), cell: (row) => row.ingredientName },
    { key: 'ordered', header: t('columns.ordered'), align: 'right', cell: (row) => <span className={styles.num}>{format.number(row.quantity)} {row.unitCode}</span> },
    {
      key: 'received',
      header: t('columns.received'),
      align: 'right',
      cell: (row) => (
        <span className={row.receivedQuantity > 0 && row.receivedQuantity < row.quantity ? styles.low : styles.num}>
          {format.number(row.receivedQuantity)} {row.unitCode}
        </span>
      ),
    },
    { key: 'price', header: t('columns.unitPrice'), align: 'right', hideOnMobile: true, cell: (row) => format.money(row.unitPrice) },
    { key: 'total', header: t('columns.lineTotal'), align: 'right', cell: (row) => format.money(row.lineTotal) },
  ];

  return (
    <>
      <PageHeader
        back={back}
        title={t('detailTitle', { number: purchase.number, supplier: purchase.supplierName })}
        meta={<StatusBadge domain="purchase" status={purchase.status} />}
        description={[
          purchase.expectedAt ? t('expectedOn', { date: format.date(purchase.expectedAt) }) : null,
          purchase.comment,
        ].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            {canManage && isDraft && <Button icon={<Pencil />} onClick={() => setEditing(true)}>{t('actions.edit')}</Button>}
            {canManage && isDraft && <Button icon={<Send />} onClick={() => setPending('submit')}>{t('actions.submit')}</Button>}
            {cancellable && <Button variant="danger" icon={<Ban />} onClick={() => setPending('cancel')}>{t('actions.cancel')}</Button>}
            {canReceive && receivable && (
              <Button variant="primary" icon={<PackageCheck />} onClick={() => setReceiving(true)}>{t('actions.receive')}</Button>
            )}
          </>
        }
      />
      <Card flush>
        <DataTable caption={t('linesCaption')} columns={columns} rows={purchase.items ?? []} getRowId={(row) => row.id} emptyTitle={t('noLines')} />
      </Card>
      <p className={styles.total}>
        <span>{t('total')}</span>
        <span>{format.money(purchase.total)}</span>
      </p>
      <PurchaseFormModal open={editing} purchase={purchase} onClose={() => setEditing(false)} />
      <ReceivePurchaseModal purchase={receiving ? purchase : null} onClose={() => setReceiving(false)} />
      <ConfirmDialog
        open={pending !== null}
        danger={pending === 'cancel'}
        title={pending ? t(`confirm.${pending}Title`) : ''}
        message={pending ? t(`confirm.${pending}Message`, { number: purchase.number }) : undefined}
        confirmLabel={pending ? t(`actions.${pending}`) : undefined}
        loading={action.isPending}
        onConfirm={() => void run()}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
