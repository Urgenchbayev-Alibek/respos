import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useReducer, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCouriers, useCreateDelivery } from '@/entities/delivery/delivery.queries';
import { localizedName, type MenuItemDto } from '@/entities/menu/menu.types';
import { usePosMenu } from '@/entities/menu/menu.queries';
import { cartPreviewTotal, cartReducer, toAddItems, type CartLine } from '@/features/waiter-order/model/cart';
import { ItemOptionsSheet } from '@/features/waiter-order/ui/ItemOptionsSheet';
import { PosMenu } from '@/features/waiter-order/ui/PosMenu';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { applyServerFieldErrors, getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, EmptyState, ErrorState, FormField, IconButton, Input, Modal, PageLoader, Select, Textarea, useToast } from '@/shared/ui';
import { DELIVERY_DETAIL_FIELDS, deliveryDetailsSchema, normalizePhone, type DeliveryDetailsValues } from '../model/delivery-form';
import styles from './Delivery.module.css';

export interface CreateDeliveryModalProps {
  open: boolean;
  onClose: () => void;
}

/** New delivery order: customer + address, items from the POS menu (same picker as the waiter), optional courier. */
export function CreateDeliveryModal({ open, onClose }: CreateDeliveryModalProps) {
  const { t, i18n } = useTranslation('delivery');
  const format = useFormatters();
  const toast = useToast();
  const menu = usePosMenu();
  const couriers = useCouriers();
  const create = useCreateDelivery();
  const [cart, dispatch] = useReducer(cartReducer, [] as CartLine[]);
  const [picking, setPicking] = useState<MenuItemDto | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setError, setValue, reset, formState } = useForm<DeliveryDetailsValues>({
    resolver: zodResolver(deliveryDetailsSchema),
    defaultValues: { customerName: '', customerPhone: '', address: '', courierId: '' },
  });

  const close = () => {
    reset();
    dispatch({ type: 'clear' });
    setServerError(null);
    onClose();
  };

  const pick = (item: MenuItemDto) => {
    if (item.variants.length > 0 || item.modifierGroups.length > 0) {
      setPicking(item);
      return;
    }
    dispatch({
      type: 'add',
      line: { menuItemId: item.id, name: localizedName(item, i18n.language), unitPrice: item.price, modifierOptionIds: [], modifierNames: [], quantity: 1, comment: '' },
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (cart.length === 0) {
      setServerError(t('create.itemsRequired'));
      return;
    }
    const parsed = deliveryDetailsSchema.parse(values);
    try {
      const created = await create.mutateAsync({
        ...parsed,
        customerPhone: normalizePhone(parsed.customerPhone) ?? parsed.customerPhone,
        courierId: parsed.courierId || undefined,
        items: toAddItems(cart),
      });
      toast.success(t('create.created', { number: created.displayNumber }));
      close();
    } catch (error) {
      if (!applyServerFieldErrors(error, setError, DELIVERY_DETAIL_FIELDS)) setServerError(getErrorMessage(error, t));
    }
  });

  const errors = formState.errors;
  const phoneField = register('customerPhone');
  const courierOptions = [{ value: '', label: t('courier.none') }, ...(couriers.data ?? []).map((c) => ({ value: c.id, label: c.name }))];

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={t('create.title')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" loading={formState.isSubmitting} onClick={() => void onSubmit()}>
            {t('create.submit')}
          </Button>
        </>
      }
    >
      <form className={styles.createGrid} onSubmit={onSubmit} noValidate>
        <div className={styles.createDetails}>
          {serverError && <Alert>{serverError}</Alert>}
          <FormField label={t('fields.customerPhone')} error={errors.customerPhone?.message} required>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+998 90 123 45 67"
              {...phoneField}
              onBlur={(event) => {
                void phoneField.onBlur(event);
                const normalized = normalizePhone(event.target.value);
                if (normalized) setValue('customerPhone', normalized);
              }}
            />
          </FormField>
          <FormField label={t('fields.customerName')} error={errors.customerName?.message} required>
            <Input {...register('customerName')} />
          </FormField>
          <FormField label={t('fields.address')} error={errors.address?.message} required>
            <Textarea rows={2} {...register('address')} />
          </FormField>
          <div className={styles.triple}>
            <FormField label={t('fields.entrance')} error={errors.entrance?.message}><Input {...register('entrance')} /></FormField>
            <FormField label={t('fields.floor')} error={errors.floor?.message}><Input {...register('floor')} /></FormField>
            <FormField label={t('fields.apartment')} error={errors.apartment?.message}><Input {...register('apartment')} /></FormField>
          </div>
          <FormField label={t('fields.comment')} error={errors.comment?.message}>
            <Textarea rows={2} {...register('comment')} />
          </FormField>
          <FormField label={t('fields.courier')}>
            <Select options={courierOptions} {...register('courierId')} />
          </FormField>
          <section aria-label={t('create.cart')}>
            <h3 className={styles.cartTitle}>{t('create.cart')}</h3>
            {cart.length === 0 ? (
              <EmptyState compact title={t('create.cartEmpty')} />
            ) : (
              <ul className={styles.cart}>
                {cart.map((line) => (
                  <li key={line.key} className={styles.cartLine}>
                    <span>
                      {line.name}
                      {line.variantName ? ` · ${line.variantName}` : ''}
                    </span>
                    <span className={styles.cartQty}>
                      <IconButton label={t('create.decrease')} icon={<Minus />} size="sm" onClick={() => dispatch({ type: 'decrement', key: line.key })} />
                      <strong>{line.quantity}</strong>
                      <IconButton label={t('create.increase')} icon={<Plus />} size="sm" onClick={() => dispatch({ type: 'increment', key: line.key })} />
                      <IconButton label={t('create.remove')} icon={<Trash2 />} size="sm" onClick={() => dispatch({ type: 'remove', key: line.key })} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.preview}>
              {t('create.preview', { amount: format.money(cartPreviewTotal(cart)) })}
            </p>
          </section>
        </div>
        <div className={styles.createMenu}>
          {menu.isLoading && <PageLoader />}
          {menu.error && <ErrorState error={menu.error} onRetry={() => void menu.refetch()} />}
          {menu.data && <PosMenu categories={menu.data} onPick={pick} />}
        </div>
      </form>
      {picking && (
        <ItemOptionsSheet
          item={picking}
          onClose={() => setPicking(null)}
          onAdd={(line) => {
            dispatch({ type: 'add', line });
            setPicking(null);
          }}
        />
      )}
    </Modal>
  );
}
