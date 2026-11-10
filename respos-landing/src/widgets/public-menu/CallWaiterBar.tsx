import { BellRing, Receipt } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/shared/api/client';
import { callWaiter, type WaiterCallReason } from '@/shared/api/publicMenuApi';
import { Button } from '@/shared/ui/Button';
import styles from './PublicMenu.module.css';

type Feedback = { tone: 'success' | 'error'; text: string } | null;

/** Sticky bottom bar on a table's QR menu: "call waiter" / "ask for the bill". */
export function CallWaiterBar({ slug, tableNumber }: { slug: string; tableNumber: string }) {
  const { t, i18n } = useTranslation();
  const [sending, setSending] = useState<WaiterCallReason | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const send = async (reason: WaiterCallReason) => {
    setSending(reason);
    setFeedback(null);
    try {
      await callWaiter(slug, tableNumber, reason, i18n.language);
      setFeedback({ tone: 'success', text: t(reason === 'bill' ? 'qrMenu.call.sentBill' : 'qrMenu.call.sentWaiter') });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      const key = status === 429 ? 'tooMany' : status === 404 ? 'tableNotFound' : 'failed';
      setFeedback({ tone: 'error', text: t(`qrMenu.call.${key}`) });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className={styles.callBar}>
      <p className={styles.feedback} role="status" aria-live="polite" data-tone={feedback?.tone}>
        {feedback?.text}
      </p>
      <div className={styles.callButtons}>
        <Button size="lg" block disabled={sending !== null} icon={<BellRing aria-hidden="true" />} onClick={() => void send('call')}>
          {t('qrMenu.call.waiter')}
        </Button>
        <Button size="lg" block variant="secondary" disabled={sending !== null} icon={<Receipt aria-hidden="true" />} onClick={() => void send('bill')}>
          {t('qrMenu.call.bill')}
        </Button>
      </div>
    </div>
  );
}
