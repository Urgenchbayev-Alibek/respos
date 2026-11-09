import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { Modal } from '../Modal/Modal';
import { Textarea } from '../Textarea/Textarea';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  /** Dangerous operations get a red confirm button (default true). */
  danger?: boolean;
  loading?: boolean;
  /** Ask for a reason (cancel order, refund…). Confirm is disabled until filled when `reasonRequired`. */
  withReason?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Confirmation for dangerous operations (spec §6.4). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = true,
  loading = false,
  withReason = false,
  reasonRequired = false,
  reasonLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const missingReason = withReason && reasonRequired && reason.trim().length === 0;

  const close = () => {
    setReason('');
    onCancel();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={message}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button onClick={close} disabled={loading}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            disabled={missingReason}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel ?? t('common:actions.confirm')}
          </Button>
        </>
      }
    >
      {withReason && (
        <FormField label={reasonLabel ?? t('common:fields.reason')} required={reasonRequired}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} data-autofocus maxLength={500} />
        </FormField>
      )}
    </Modal>
  );
}
