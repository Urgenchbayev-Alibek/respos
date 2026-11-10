import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/shared/constants/routes';
import { Tabs } from '@/shared/ui';

/** Route tabs of the admin Staff section. */
export function StaffTabs() {
  const { t } = useTranslation('staff');
  return (
    <Tabs
      ariaLabel={t('nav.title')}
      items={[
        { id: 'entries', label: t('tabs.entries'), to: ROUTES.admin.staff },
        { id: 'timesheet', label: t('tabs.timesheet'), to: ROUTES.admin.staffTimesheet },
        { id: 'schedule', label: t('tabs.schedule'), to: ROUTES.admin.staffSchedule },
        { id: 'members', label: t('tabs.members'), to: ROUTES.admin.staffMembers },
        { id: 'devices', label: t('tabs.devices'), to: ROUTES.admin.staffDevices },
      ]}
    />
  );
}
