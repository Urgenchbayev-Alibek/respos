import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useCustomer, useDeleteCustomer } from '@/entities/customer/customer.queries';
import { CustomerBadges } from '@/features/customers/ui/CustomerBadges';
import { CustomerFormModal, type CustomerFormTarget } from '@/features/customers/ui/CustomerFormModal';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Button, Card, ConfirmDialog, ErrorState, PageHeader, PageLoader, StatCard, Tabs, useToast } from '@/shared/ui';
import styles from './CustomerDetailPage.module.css';
import { CustomerLedgerTable, CustomerOrdersTable } from './CustomerHistoryTables';

/** Admin → guest card: profile, stats, orders history and points ledger. */
export function CustomerDetailPage() {
  const { t } = useTranslation('customers');
  const { customerId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.customers.manage);
  const query = useCustomer(customerId);
  const remove = useDeleteCustomer();
  const [tab, setTab] = useState<'orders' | 'ledger'>('orders');
  const [editing, setEditing] = useState<CustomerFormTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (query.isPending) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data;

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(c.id);
      toast.success(t('toast.deleted'));
      navigate(ROUTES.admin.customers);
    } catch (error) {
      toast.error(t('toast.deleteFailed'), getErrorMessage(error, t));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button variant="ghost" icon={<ArrowLeft />} onClick={() => navigate(ROUTES.admin.customers)}>{t('detail.back')}</Button>
      <PageHeader
        title={c.name}
        description={<CustomerBadges isVip={c.isVip} isBirthdayToday={c.isBirthdayToday} isBirthdaySoon={c.isBirthdaySoon} />}
        actions={
          canManage && (
            <>
              <Button icon={<Pencil />} onClick={() => setEditing({ customer: c })}>{t('actions.edit')}</Button>
              <Button variant="danger" icon={<Trash2 />} onClick={() => setDeleting(true)}>{t('actions.delete')}</Button>
            </>
          )
        }
      />
      <div className={styles.stats}>
        <StatCard label={t('columns.visits')} value={c.stats.visits} />
        <StatCard label={t('columns.totalSpent')} value={format.money(c.stats.totalSpent)} />
        <StatCard label={t('columns.averageCheck')} value={format.money(c.stats.averageCheck)} />
        <StatCard
          label={t('columns.points')}
          value={format.number(c.loyalty.points, 0)}
          hint={t('detail.lifetime', {
            earned: format.number(c.loyalty.lifetimeEarned, 0),
            redeemed: format.number(c.loyalty.lifetimeRedeemed, 0),
          })}
        />
      </div>
      <Card title={t('detail.profile')}>
        <dl className={styles.profile}>
          <dt>{t('fields.phone')}</dt>
          <dd>{c.phone}</dd>
          <dt>{t('fields.birthday')}</dt>
          <dd>{c.birthday ? format.date(`${c.birthday}T12:00:00Z`) : '—'}</dd>
          <dt>{t('fields.gender')}</dt>
          <dd>{c.gender ? t(`gender.${c.gender}`) : '—'}</dd>
          <dt>{t('fields.tags')}</dt>
          <dd>{c.tags.length > 0 ? c.tags.join(', ') : '—'}</dd>
          <dt>{t('columns.lastVisit')}</dt>
          <dd>{c.stats.lastVisitAt ? format.dateTime(c.stats.lastVisitAt) : '—'}</dd>
          <dt>{t('fields.marketingConsent')}</dt>
          <dd>{t(c.marketingConsent ? 'detail.yes' : 'detail.no')}</dd>
          <dt>{t('fields.notes')}</dt>
          <dd>{c.notes ?? '—'}</dd>
        </dl>
      </Card>
      <Tabs
        ariaLabel={t('detail.historyLabel')}
        value={tab}
        onChange={(id) => setTab(id as 'orders' | 'ledger')}
        items={[
          { id: 'orders', label: t('detail.orders') },
          { id: 'ledger', label: t('detail.ledger') },
        ]}
      />
      {tab === 'orders' ? <CustomerOrdersTable customerId={c.id} /> : <CustomerLedgerTable customerId={c.id} />}
      <CustomerFormModal target={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting}
        title={t('confirm.deleteTitle')}
        message={t('confirm.deleteMessage', { name: c.name })}
        confirmLabel={t('actions.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(false)}
      />
    </>
  );
}
