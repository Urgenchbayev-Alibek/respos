import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, DemoBadge, useToast } from '@/shared/ui';
import styles from './UserForm.module.css';

/** MVP: email is a stub provider, so the invite link is shown to the admin (dev/demo only). */
export function InviteLinkResult({ link }: { link: string }) {
  const { t } = useTranslation('users');
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('invite.copied'));
    } catch {
      toast.error(t('invite.copyFailed'));
    }
  };

  return (
    <div className={styles.inviteLink}>
      <Alert tone="success">{t('invite.created')}</Alert>
      <p>
        {t('invite.linkHint')} <DemoBadge kind="not-connected" title={t('invite.emailStub')} />
      </p>
      <code className={styles.linkBox}>{link}</code>
      <div>
        <Button icon={<Copy />} onClick={() => void copy()}>
          {t('invite.copy')}
        </Button>
      </div>
    </div>
  );
}
