import clsx from 'clsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedName, type MenuItemDto } from '@/entities/menu/menu.types';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { Button, FormField, Modal, Textarea } from '@/shared/ui';
import type { CartLine } from '../model/cart';
import {
  maxFor,
  minFor,
  toggleOption,
  validateSelection,
  type GroupError,
  type ModifierSelection,
} from '../model/modifier-selection';
import { QuantityStepper } from './QuantityStepper';
import styles from './ItemOptionsSheet.module.css';

export interface ItemOptionsSheetProps {
  item: MenuItemDto;
  onAdd: (line: Omit<CartLine, 'key'>) => void;
  onClose: () => void;
}

/** Variant + modifiers + quantity + comment for one dish; required groups are checked before adding. */
export function ItemOptionsSheet({ item, onAdd, onClose }: ItemOptionsSheetProps) {
  const { t, i18n } = useTranslation('waiter');
  const format = useFormatters();
  const defaultVariant = item.variants.find((variant) => variant.isDefault) ?? item.variants[0];
  const [variantId, setVariantId] = useState<string | undefined>(defaultVariant?.id);
  const [selection, setSelection] = useState<ModifierSelection>({});
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Record<string, GroupError>>({});
  const name = localizedName(item, i18n.language);

  const variant = item.variants.find((candidate) => candidate.id === variantId);
  const options = item.modifierGroups.flatMap((group) =>
    group.options.filter((option) => selection[group.id]?.includes(option.id)),
  );
  const unitPrice = (variant?.price ?? item.price) + options.reduce((sum, option) => sum + option.priceDelta, 0);

  const toggle = (groupId: string, optionId: string) => {
    const group = item.modifierGroups.find((candidate) => candidate.id === groupId);
    if (!group) return;
    const next = toggleOption(group, selection, optionId);
    setSelection(next);
    if (errors[groupId]) {
      const { [groupId]: _removed, ...rest } = errors;
      setErrors(validateSelection([group], next)[groupId] ? errors : rest);
    }
  };

  const add = () => {
    const found = validateSelection(item.modifierGroups, selection);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onAdd({
      menuItemId: item.id,
      variantId: variant?.id,
      name,
      variantName: variant?.name,
      unitPrice,
      modifierOptionIds: options.map((option) => option.id),
      modifierNames: options.map((option) => option.name),
      quantity,
      comment: comment.trim(),
    });
  };

  const groupError = (error: GroupError | undefined) =>
    error && (error.kind === 'min' ? t('options.errorMin', { min: error.min }) : t('options.errorMax', { max: error.max }));

  return (
    <Modal
      open
      onClose={onClose}
      title={name}
      description={item.description ?? undefined}
      footer={
        <>
          <Button size="lg" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button size="lg" variant="primary" onClick={add}>
            {t('options.add', { price: format.money(unitPrice * quantity) })}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {item.variants.length > 0 && (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('options.variant')}</legend>
            <div className={styles.choices}>
              {item.variants.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={clsx(styles.choice, candidate.id === variantId && styles.selected)}
                  aria-pressed={candidate.id === variantId}
                  onClick={() => setVariantId(candidate.id)}
                >
                  <span>{candidate.name}</span>
                  <span className={styles.price}>{format.money(candidate.price)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {item.modifierGroups.map((group) => {
          const error = groupError(errors[group.id]);
          return (
            <fieldset key={group.id} className={clsx(styles.group, error && styles.invalid)} aria-invalid={Boolean(error)}>
              <legend className={styles.legend}>
                {group.name}
                <span className={styles.rule}>
                  {minFor(group) > 0 ? t('options.required') : t('options.optional')}
                  {maxFor(group) > 1 && ` · ${t('options.upTo', { max: maxFor(group) })}`}
                </span>
              </legend>
              <div className={styles.choices}>
                {group.options.map((option) => {
                  const selected = Boolean(selection[group.id]?.includes(option.id));
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={clsx(styles.choice, selected && styles.selected)}
                      aria-pressed={selected}
                      onClick={() => toggle(group.id, option.id)}
                    >
                      <span>{option.name}</span>
                      {option.priceDelta !== 0 && <span className={styles.price}>+{format.money(option.priceDelta)}</span>}
                    </button>
                  );
                })}
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
            </fieldset>
          );
        })}
        <div className={styles.row}>
          <span className={styles.legend}>{t('options.quantity')}</span>
          <QuantityStepper value={quantity} onChange={setQuantity} label={name} />
        </div>
        <FormField label={t('options.comment')}>
          <Textarea rows={2} maxLength={200} value={comment} onChange={(event) => setComment(event.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}
