import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplySuggestions, usePurchaseSuggestions } from '@/entities/purchase-suggestion/purchase-suggestion.queries';
import type { PurchaseSuggestionGroupDto } from '@/entities/purchase-suggestion/purchase-suggestion.types';
import styles from '@/features/stock/ui/stock.module.css';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { parseDecimal } from '@/shared/lib/quantity';
import { Alert, Button, Checkbox, EmptyState, ErrorState, FormField, Input, Modal, Spinner, useToast } from '@/shared/ui';

export interface PurchaseSuggestionsModalProps {
  open: boolean;
  onClose: () => void;
}

interface LineState {
  selected: boolean;
  quantity: string;
}

const MAX_DAYS = 90;
const keyOf = (supplierId: string, ingredientId: string) => `${supplierId}:${ingredientId}`;

/** Suggested purchases (below minimum + projected consumption) → one draft purchase order per supplier. */
export function PurchaseSuggestionsModal({ open, onClose }: PurchaseSuggestionsModalProps) {
  const { t } = useTranslation('purchaseSuggestions');
  const toast = useToast();
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const [coverageText, setCoverageText] = useState('7');
  const coverage = useDebouncedValue(Math.min(MAX_DAYS, Math.max(0, Math.trunc(parseDecimal(coverageText) ?? 0))), 400);
  const query = usePurchaseSuggestions({ coverageDays: coverage }, open);
  const apply = useApplySuggestions();
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [error, setError] = useState<string | null>(null);
  const canApply = hasPermission(PERMISSIONS.purchases.manage);

  const groups = useMemo(() => query.data?.groups ?? [], [query.data]);
  useEffect(() => {
    const next: Record<string, LineState> = {};
    for (const group of groups) {
      if (!group.supplierId) continue;
      for (const line of group.lines) {
        next[keyOf(group.supplierId, line.ingredientId)] = {
          selected: true,
          quantity: String(line.suggestedQuantity),
        };
      }
    }
    setLines(next);
    setError(null);
  }, [groups]);

  const chosen = groups.flatMap((group) =>
    group.supplierId
      ? group.lines
          .map((line) => ({
            line,
            state: lines[keyOf(group.supplierId ?? '', line.ingredientId)],
            supplierId: group.supplierId ?? '',
          }))
          .filter((x) => x.state?.selected)
      : [],
  );
  const invalid = chosen.some((x) => !((parseDecimal(x.state?.quantity) ?? 0) > 0));

  const submit = async () => {
    setError(null);
    try {
      const created = await apply.mutateAsync({
        comment: t('comment'),
        lines: chosen.map((x) => ({
          ingredientId: x.line.ingredientId,
          supplierId: x.supplierId,
          quantity: parseDecimal(x.state?.quantity) ?? 0,
        })),
      });
      toast.success(t('applied', { count: created.length }));
      onClose();
    } catch (applyError) {
      setError(getErrorMessage(applyError, t));
    }
  };

  const update = (key: string, patch: Partial<LineState>) =>
    setLines((current) => ({
      ...current,
      [key]: { selected: true, quantity: '', ...current[key], ...patch },
    }));

  const renderGroup = (group: PurchaseSuggestionGroupDto) => (
    <section key={group.supplierId ?? 'none'} className={styles.stack} aria-label={group.supplierName ?? t('noSupplier')}>
      <h3>
        {group.supplierName ?? t('noSupplier')} · {format.money(group.estimatedTotal)}
      </h3>
      {!group.supplierId && <p className={styles.hint}>{t('noSupplierHint')}</p>}
      <div className={styles.linesScroll}>
        <table className={styles.linesTable}>
          <thead>
            <tr>
              {group.supplierId && (
                <th scope="col">
                  <span className="visually-hidden">{t('columns.include')}</span>
                </th>
              )}
              <th scope="col">{t('columns.ingredient')}</th>
              <th scope="col">{t('columns.stock')}</th>
              <th scope="col">{t('columns.onOrder')}</th>
              <th scope="col">{t('columns.avgDaily')}</th>
              <th scope="col">{t('columns.suggested')}</th>
              <th scope="col">{t('columns.lastPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {group.lines.map((line) => {
              const key = keyOf(group.supplierId ?? '', line.ingredientId);
              const state = lines[key];
              return (
                <tr key={line.ingredientId}>
                  {group.supplierId && (
                    <td>
                      <Checkbox
                        aria-label={t('columns.include')}
                        checked={state?.selected ?? false}
                        onChange={(event) => update(key, { selected: event.target.checked })}
                      />
                    </td>
                  )}
                  <td>{line.ingredientName}</td>
                  <td className={line.currentQuantity <= line.minQuantity ? styles.low : undefined}>
                    {format.number(line.currentQuantity)} / {format.number(line.minQuantity)} {line.baseUnitCode}
                  </td>
                  <td>{format.number(line.onOrderQuantity)}</td>
                  <td>{format.number(line.avgDailyConsumption)}</td>
                  <td>
                    {group.supplierId ? (
                      <Input
                        className={styles.lineInput}
                        inputMode="decimal"
                        aria-label={t('columns.suggested')}
                        value={state?.quantity ?? ''}
                        onChange={(event) => update(key, { quantity: event.target.value })}
                      />
                    ) : (
                      format.number(line.suggestedQuantity)
                    )}{' '}
                    {line.baseUnitCode}
                  </td>
                  <td>{format.money(line.lastPrice)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('title')}
      dismissible={!apply.isPending}
      footer={
        <>
          <Button onClick={onClose} disabled={apply.isPending}>
            {t('common:actions.close')}
          </Button>
          {canApply && (
            <Button variant="primary" loading={apply.isPending} disabled={chosen.length === 0 || invalid} onClick={() => void submit()}>
              {t('apply', {
                count: new Set(chosen.map((x) => x.supplierId)).size,
              })}
            </Button>
          )}
        </>
      }
    >
      <div className={styles.stack}>
        <p className={styles.hint}>{t('description', { lookback: query.data?.lookbackDays ?? 14 })}</p>
        <FormField label={t('coverageDays')} hint={t('coverageHint')}>
          <Input
            type="number"
            min={0}
            max={MAX_DAYS}
            inputMode="numeric"
            value={coverageText}
            onChange={(event) => setCoverageText(event.target.value)}
          />
        </FormField>
        {error && <Alert>{error}</Alert>}
        {invalid && <Alert>{t('invalidQuantity')}</Alert>}
        {query.isLoading && <Spinner />}
        {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
        {query.data && groups.length === 0 && <EmptyState title={t('empty')} />}
        {groups.map(renderGroup)}
      </div>
    </Modal>
  );
}
