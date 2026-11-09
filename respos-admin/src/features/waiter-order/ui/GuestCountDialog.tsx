import clsx from 'clsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '@/shared/ui';
import { QuantityStepper } from './QuantityStepper';
import styles from './GuestCountDialog.module.css';

export interface GuestCountDialogProps {
  title: string;
  initial: number;
  onConfirm: (guests: number) => void;
  onClose: () => void;
}

const QUICK = [1, 2, 3, 4, 5, 6, 8, 10];

/** Number of guests before opening a new order (quick picks + stepper). */
export function GuestCountDialog({ title, initial, onConfirm, onClose }: GuestCountDialogProps) {
  const { t } = useTranslation('waiter');
  const [guests, setGuests] = useState(Math.max(1, initial));
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={title}
      description={t('guests.question')}
      footer={
        <>
          <Button size="lg" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button size="lg" variant="primary" data-autofocus onClick={() => onConfirm(guests)}>
            {t('guests.open')}
          </Button>
        </>
      }
    >
      <div className={styles.quick} role="group" aria-label={t('guests.label')}>
        {QUICK.map((value) => (
          <button
            key={value}
            type="button"
            className={clsx(styles.option, value === guests && styles.selected)}
            aria-pressed={value === guests}
            onClick={() => setGuests(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div className={styles.stepperRow}>
        <span>{t('guests.label')}</span>
        <QuantityStepper value={guests} onChange={setGuests} label={t('guests.label')} />
      </div>
    </Modal>
  );
}
