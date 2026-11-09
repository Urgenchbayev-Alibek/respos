import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCompleteCount, useStockCount, useUpdateCount } from '@/entities/stock/stock.queries';
import type { InventoryCountDto } from '@/entities/stock/stock.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { parseDecimal } from '@/shared/lib/quantity';
import { V } from '@/shared/lib/validation';
import { Alert, Button, ConfirmDialog, ErrorState, Input, Modal, PageLoader, StatusBadge, useToast } from '@/shared/ui';
import styles from './stock.module.css';

const countedSchema = z
  .string()
  .refine((value) => value.trim() === '' || (parseDecimal(value) ?? -1) >= 0, V.quantity)
  .refine((value) => value.trim() === '' || /^\d+([.,]\d{1,3})?$/.test(value.trim()), V.quantity);
const schema = z.object({ lines: z.array(z.object({ ingredientId: z.string(), countedQty: countedSchema })) });
type Values = z.infer<typeof schema>;

function toValues(count: InventoryCountDto | undefined): Values {
  return {
    lines: (count?.lines ?? []).map((line) => ({
      ingredientId: line.ingredientId,
      countedQty: line.countedQty === null || line.countedQty === undefined ? '' : String(line.countedQty),
    })),
  };
}

/** Counted quantities vs expected snapshot; "Complete" creates `inventory_count` adjustments (confirmed). */
export function CountEditorModal({ countId, onClose }: { countId: string | null; onClose: () => void }) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const query = useStockCount(countId);
  const update = useUpdateCount();
  const complete = useCompleteCount();
  const [confirming, setConfirming] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { lines: [] } });
  const { control, register, handleSubmit, reset, formState } = form;
  const { fields } = useFieldArray({ control, name: 'lines' });
  const watched = useWatch({ control, name: 'lines' });
  const count = query.data;
  const editable = count?.status === 'draft' && hasPermission(PERMISSIONS.inventory.adjust);

  useEffect(() => {
    reset(toValues(query.data));
    setServerError(null);
  }, [query.data, reset]);

  const save = async (values: Values) => {
    if (!countId) return;
    const lines = values.lines
      .map((line) => ({ ingredientId: line.ingredientId, countedQty: parseDecimal(line.countedQty) }))
      .filter((line): line is { ingredientId: string; countedQty: number } => line.countedQty !== undefined);
    await update.mutateAsync({ id: countId, lines });
  };

  const onSave = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save(values);
      toast.success(t('counts.saved'));
    } catch (error) {
      setServerError(getErrorMessage(error, t));
    }
  });

  const onComplete = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save(values);
      if (countId) await complete.mutateAsync(countId);
      toast.success(t('counts.completed'));
      setConfirming(false);
      onClose();
    } catch (error) {
      setConfirming(false);
      setServerError(getErrorMessage(error, t));
    }
  });

  const busy = formState.isSubmitting || update.isPending || complete.isPending;
  const lines = count?.lines ?? [];
  return (
    <Modal
      open={countId !== null}
      onClose={onClose}
      size="lg"
      dismissible={!busy}
      title={t('counts.editorTitle', { number: count?.number ?? '' })}
      description={count && <StatusBadge domain="inventoryCount" status={count.status} />}
      footer={
        editable ? (
          <>
            <Button onClick={() => void onSave()} loading={update.isPending && !confirming}>{t('counts.saveDraft')}</Button>
            <Button variant="primary" onClick={() => setConfirming(true)} disabled={busy}>{t('counts.complete')}</Button>
          </>
        ) : (
          <Button onClick={onClose}>{t('common:actions.close')}</Button>
        )
      }
    >
      {query.isLoading && <PageLoader />}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {count && (
        <div className={styles.stack}>
          {serverError && <Alert>{serverError}</Alert>}
          {lines.length === 0 ? (
            <p className={styles.muted}>{t('counts.noLines')}</p>
          ) : (
            <div className={styles.linesScroll}>
              <table className={styles.linesTable}>
                <thead>
                  <tr>
                    <th scope="col">{t('columns.ingredient')}</th>
                    <th scope="col">{t('columns.expected')}</th>
                    <th scope="col">{t('columns.counted')}</th>
                    <th scope="col">{t('columns.difference')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    const line = lines[index];
                    if (!line) return null;
                    const counted = parseDecimal(watched?.[index]?.countedQty ?? '');
                    const diff = counted === undefined ? null : counted - line.expectedQty;
                    const error = formState.errors.lines?.[index]?.countedQty?.message;
                    return (
                      <tr key={field.id}>
                        <td>{line.ingredientName}</td>
                        <td className={styles.num}>{format.number(line.expectedQty)} {line.unitCode ?? ''}</td>
                        <td>
                          <Input
                            className={styles.lineInput}
                            inputMode="decimal"
                            aria-label={t('counts.countedFor', { name: line.ingredientName })}
                            aria-invalid={Boolean(error) || undefined}
                            disabled={!editable}
                            {...register(`lines.${index}.countedQty`)}
                          />
                          {error && <small role="alert" className={styles.negative}>{t(error)}</small>}
                        </td>
                        <td className={diff !== null && diff < 0 ? styles.negative : styles.num}>
                          {diff === null ? '—' : `${diff > 0 ? '+' : ''}${format.number(diff)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        danger={false}
        title={t('counts.completeTitle')}
        message={t('counts.completeMessage')}
        confirmLabel={t('counts.complete')}
        loading={busy}
        onConfirm={() => void onComplete()}
        onCancel={() => setConfirming(false)}
      />
    </Modal>
  );
}
