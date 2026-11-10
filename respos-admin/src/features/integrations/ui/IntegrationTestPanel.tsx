import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTestIntegration } from '@/entities/integration/integration.queries';
import type { IntegrationDto, IntegrationTestResultDto } from '@/entities/integration/integration.types';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { Alert, Button, FormField, Input } from '@/shared/ui';
import styles from './integrations.module.css';

/** "Отправить тест": uses the SAVED settings; SMS / e-mail need a recipient. */
export function IntegrationTestPanel({ integration }: { integration: IntegrationDto }) {
  const { t } = useTranslation('integrations');
  const test = useTestIntegration();
  const [recipient, setRecipient] = useState('');
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const needsRecipient = integration.type !== 'telegram';
  const canTest = integration.isEnabled && integration.isConfigured && (!needsRecipient || recipient.trim().length > 0);

  const run = async () => {
    setResult(null);
    try {
      const response: IntegrationTestResultDto = await test.mutateAsync({ type: integration.type, recipient: recipient.trim() });
      setResult(response.success
        ? { tone: 'success', text: t('test.success') }
        : { tone: 'error', text: t('test.failed', { error: response.error ?? '' }) });
    } catch (error) {
      setResult({ tone: 'error', text: getErrorMessage(error, t) });
    }
  };

  return (
    <div className={styles.test}>
      {needsRecipient && (
        <FormField label={t(`test.recipient.${integration.type}`)} hint={t('test.recipientHint')}>
          <Input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            type={integration.type === 'smtp' ? 'email' : 'tel'}
            autoComplete="off"
          />
        </FormField>
      )}
      {!integration.isConfigured && <p className={styles.muted}>{t('test.saveFirst')}</p>}
      <Button variant="secondary" onClick={() => void run()} loading={test.isPending} disabled={!canTest}>
        {t('test.send')}
      </Button>
      {result && <Alert tone={result.tone}>{result.text}</Alert>}
    </div>
  );
}
