import { useTranslation } from 'react-i18next';
import { useUsers } from '@/entities/user/user.queries';
import { MAX_PAGE_SIZE } from '@/shared/types/pagination';
import { Select } from '@/shared/ui';

/** Staff filter for order lists. Render only with `users.read` (it loads `GET /users`). */
export function WaiterFilter({ value, onChange }: { value: string; onChange: (waiterId: string) => void }) {
  const { t } = useTranslation('orders');
  const users = useUsers({ pageSize: MAX_PAGE_SIZE, status: 'active', sort: 'fullName:asc' });
  return (
    <Select
      aria-label={t('columns.waiter')}
      placeholder={t('filters.allWaiters')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={(users.data?.items ?? []).map((user) => ({ value: user.id, label: user.fullName }))}
    />
  );
}
