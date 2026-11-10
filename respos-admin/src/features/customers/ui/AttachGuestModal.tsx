import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAttachCustomer, useCustomers } from '@/entities/customer/customer.queries';
import type { CustomerListItemDto } from '@/entities/customer/customer.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, EmptyState, ErrorState, Modal, SearchInput, Spinner } from '@/shared/ui';
import styles from './AttachGuestModal.module.css';
import { CustomerBadges } from './CustomerBadges';
import { CustomerFormModal, type CustomerFormTarget } from './CustomerFormModal';

const MIN_SEARCH = 3;

interface AttachGuestModalProps {
  orderId: string;
  open: boolean;
  onClose: () => void;
}

/** Waiter / cashier: find a guest by phone (or name) and attach to the order; quick create with customers.manage. */
export function AttachGuestModal({ orderId, open, onClose }: AttachGuestModalProps) {
  const { t } = useTranslation('customers');
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.customers.manage);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState<CustomerFormTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const term = useDebouncedValue(search.trim());
  const enabled = open && term.length >= MIN_SEARCH;
  const results = useCustomers({ page: 1, pageSize: 10, search: term }, enabled);
  const attach = useAttachCustomer();

  const close = () => {
    setSearch('');
    setError(null);
    onClose();
  };

  const pick = async (customerId: string) => {
    setError(null);
    try {
      await attach.mutateAsync({ orderId, customerId });
      close();
    } catch (caught) {
      setError(getErrorMessage(caught, t));
    }
  };

  const rows = results.data?.items ?? [];
  return (
    <>
      <Modal open={open && creating === null} onClose={close} title={t('attach.title')} description={t('attach.description')}>
        <div className={styles.body}>
          <SearchInput value={search} onChange={setSearch} placeholder={t('attach.searchPlaceholder')} />
          {error && <Alert>{error}</Alert>}
          {!enabled ? (
            <p className={styles.hint}>{t('attach.typeMore', { count: MIN_SEARCH })}</p>
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => void results.refetch()} />
          ) : results.isPending ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState compact title={t('attach.notFound')} />
          ) : (
            <ul className={styles.list}>
              {rows.map((row) => (
                <GuestRow key={row.id} row={row} disabled={attach.isPending} onPick={() => void pick(row.id)} />
              ))}
            </ul>
          )}
          {canCreate && (
            <Button icon={<UserPlus />} onClick={() => setCreating({ customer: null, phone: search.trim() })}>
              {t('attach.create')}
            </Button>
          )}
        </div>
      </Modal>
      <CustomerFormModal target={creating} onClose={() => setCreating(null)} onSaved={(customer) => void pick(customer.id)} />
    </>
  );
}

function GuestRow({ row, disabled, onPick }: { row: CustomerListItemDto; disabled: boolean; onPick: () => void }) {
  const { t } = useTranslation('customers');
  return (
    <li className={styles.row}>
      <div className={styles.info}>
        <strong>{row.name}</strong>
        <span className={styles.phone}>{row.phone}</span>
        <CustomerBadges isVip={row.isVip} isBirthdayToday={row.isBirthdayToday} points={row.points} />
      </div>
      <Button variant="primary" disabled={disabled} onClick={onPick} aria-label={t('attach.pickLabel', { name: row.name })}>
        {t('attach.pick')}
      </Button>
    </li>
  );
}
