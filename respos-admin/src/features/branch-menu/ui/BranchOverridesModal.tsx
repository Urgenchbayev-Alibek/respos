import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useBranchMenuItems,
  useBranchStations,
  useResetBranchMenuItem,
  useSaveBranchMenuItem,
} from '@/entities/branch-menu/branch-menu.queries';
import type { BranchMenuItemDto } from '@/entities/branch-menu/branch-menu.types';
import type { MenuItemDto } from '@/entities/menu/menu.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { parseDecimal } from '@/shared/lib/quantity';
import { Alert, Button, Card, ErrorState, FormField, FormGrid, Input, Modal, Select, Spinner, StatusBadge, useToast } from '@/shared/ui';
import styles from './BranchOverridesModal.module.css';

export interface BranchOverridesModalProps {
  item: MenuItemDto | null;
  onClose: () => void;
}

/** Menu item × branches: price / variant prices / stop-list / kitchen station per branch (empty = inherit). */
export function BranchOverridesModal({ item, onClose }: BranchOverridesModalProps) {
  const { t } = useTranslation('branchMenu');
  const query = useBranchMenuItems(item?.id);
  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      size="lg"
      title={t('title', { name: item?.name ?? '' })}
      footer={<Button onClick={onClose}>{t('common:actions.close')}</Button>}
    >
      <p className={styles.hint}>{t('description')}</p>
      {query.isLoading && <Spinner />}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      <div className={styles.list}>{item && query.data?.map((row) => <BranchOverrideCard key={row.branchId} item={item} row={row} />)}</div>
    </Modal>
  );
}

type AvailabilityChoice = '' | 'on' | 'off';

interface DraftState {
  price: string;
  availability: AvailabilityChoice;
  stationId: string;
  variants: Record<string, string>;
}

function toDraft(row: BranchMenuItemDto): DraftState {
  return {
    price: row.priceOverride === null ? '' : String(row.priceOverride),
    availability: row.isAvailable === null ? '' : row.isAvailable ? 'on' : 'off',
    stationId: row.kitchenStationId ?? '',
    variants: Object.fromEntries(row.variants.map((v) => [v.variantId, v.priceOverride === null ? '' : String(v.priceOverride)])),
  };
}

const isMoney = (text: string) => text === '' || (parseDecimal(text) ?? -1) >= 0;

function BranchOverrideCard({ item, row }: { item: MenuItemDto; row: BranchMenuItemDto }) {
  const { t } = useTranslation('branchMenu');
  const toast = useToast();
  const format = useFormatters();
  const stations = useBranchStations(row.branchId);
  const save = useSaveBranchMenuItem();
  const reset = useResetBranchMenuItem();
  const [draft, setDraft] = useState<DraftState>(() => toDraft(row));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(toDraft(row)), [row]);

  const valid = isMoney(draft.price) && Object.values(draft.variants).every(isMoney);
  const busy = save.isPending || reset.isPending;
  const prefix = `branch-${row.branchId}`;

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync({
        menuItemId: item.id,
        branchId: row.branchId,
        input: {
          priceOverride: draft.price === '' ? null : (parseDecimal(draft.price) ?? 0),
          isAvailable: draft.availability === '' ? null : draft.availability === 'on',
          kitchenStationId: draft.stationId || null,
          variantPrices: Object.entries(draft.variants)
            .filter(([, price]) => price !== '')
            .map(([variantId, price]) => ({
              variantId,
              price: parseDecimal(price) ?? 0,
            })),
        },
      });
      toast.success(t('saved', { branch: row.branchName }));
    } catch (saveError) {
      setError(getErrorMessage(saveError, t));
    }
  };

  const clear = async () => {
    setError(null);
    try {
      await reset.mutateAsync({ menuItemId: item.id, branchId: row.branchId });
      toast.success(t('resetDone', { branch: row.branchName }));
    } catch (resetError) {
      setError(getErrorMessage(resetError, t));
    }
  };

  return (
    <Card>
      <section aria-label={row.branchName}>
        <div className={styles.header}>
          <h3>{row.branchName}</h3>
          <StatusBadge tone={row.hasOverride ? 'primary' : 'neutral'} size="sm">
            {t(row.hasOverride ? 'overridden' : 'inherited')}
          </StatusBadge>
          <StatusBadge tone={row.effectiveIsAvailable ? 'success' : 'danger'} size="sm">
            {t(row.effectiveIsAvailable ? 'available' : 'stopped')}
          </StatusBadge>
          <span className={styles.price}>{format.money(row.effectivePrice)}</span>
        </div>
        {error && <Alert>{error}</Alert>}
        <FormGrid
          id={`${prefix}-form`}
          columns={2}
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) void submit();
          }}
        >
          <FormField
            label={t('fields.price')}
            hint={t('fields.basePrice', { price: format.money(item.price) })}
            error={isMoney(draft.price) ? undefined : 'validation:nonNegative'}
          >
            <Input
              inputMode="decimal"
              placeholder={t('inherit')}
              value={draft.price}
              onChange={(event) => setDraft((d) => ({ ...d, price: event.target.value }))}
            />
          </FormField>
          <FormField label={t('fields.availability')}>
            <Select
              value={draft.availability}
              onChange={(event) =>
                setDraft((d) => ({
                  ...d,
                  availability: event.target.value as AvailabilityChoice,
                }))
              }
              options={[
                { value: '', label: t('inherit') },
                { value: 'on', label: t('available') },
                { value: 'off', label: t('stopped') },
              ]}
            />
          </FormField>
          <FormField label={t('fields.station')}>
            <Select
              value={draft.stationId}
              onChange={(event) => setDraft((d) => ({ ...d, stationId: event.target.value }))}
              options={[
                { value: '', label: t('inheritStation') },
                ...(stations.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </FormField>
          {row.variants.map((variant) => (
            <FormField
              key={variant.variantId}
              label={t('fields.variantPrice', { name: variant.variantName })}
              hint={t('fields.basePrice', {
                price: format.money(variant.basePrice),
              })}
              error={isMoney(draft.variants[variant.variantId] ?? '') ? undefined : 'validation:nonNegative'}
            >
              <Input
                inputMode="decimal"
                placeholder={t('inherit')}
                value={draft.variants[variant.variantId] ?? ''}
                onChange={(event) =>
                  setDraft((d) => ({
                    ...d,
                    variants: {
                      ...d.variants,
                      [variant.variantId]: event.target.value,
                    },
                  }))
                }
              />
            </FormField>
          ))}
        </FormGrid>
        <div className={styles.actions}>
          {row.hasOverride && (
            <Button variant="ghost" disabled={busy} loading={reset.isPending} onClick={() => void clear()}>
              {t('reset')}
            </Button>
          )}
          <Button variant="primary" type="submit" form={`${prefix}-form`} disabled={!valid || busy} loading={save.isPending}>
            {t('common:actions.save')}
          </Button>
        </div>
      </section>
    </Card>
  );
}
