import { Building2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes';
import { useAuth } from '@/shared/hooks/use-auth';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { DropdownMenu, useToast } from '@/shared/ui';
import styles from './TopbarTrigger.module.css';

/** Organization switcher; rendered only when the user belongs to several organizations. */
export function OrgSwitcher() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { user, switchOrganization } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user || user.organizations.length <= 1) return null;
  const current = user.currentOrganization;

  const onSelect = async (organizationId: string) => {
    if (organizationId === current?.id) return;
    setBusy(true);
    try {
      await switchOrganization(organizationId);
      navigate(ROUTES.home, { replace: true });
    } catch (error) {
      toast.error(t('nav:topbar.switchOrgFailed'), getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu
      align="start"
      header={t('nav:topbar.organization')}
      items={user.organizations.map((org) => ({
        id: org.id,
        label: org.name,
        selected: org.id === current?.id,
        disabled: busy,
        onSelect: () => void onSelect(org.id),
      }))}
      trigger={(props) => (
        <button type="button" className={styles.trigger} aria-label={t('nav:topbar.switchOrganization')} {...props}>
          <Building2 aria-hidden="true" />
          <span className={styles.label}>{current?.name ?? t('nav:topbar.organization')}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      )}
    />
  );
}
