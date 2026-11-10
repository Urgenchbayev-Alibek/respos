import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutboundMessages } from '@/entities/integration/integration.queries';
import type { OutboundChannel, OutboundMessageDto, OutboundStatus } from '@/entities/integration/integration.types';
import { IntegrationErrorsTable } from '@/features/integrations/ui/IntegrationErrorsTable';
import type { StatusTone } from '@/shared/constants/statuses';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { DEFAULT_PAGE_SIZE } from '@/shared/types/pagination';
import { Card, DataTable, PageHeader, Select, StatusBadge, Toolbar, type DataTableColumn } from '@/shared/ui';
import { IntegrationTabs } from './IntegrationsPage';

const STATUSES: OutboundStatus[] = ['pending', 'sent', 'failed', 'skipped'];
const CHANNELS: OutboundChannel[] = ['telegram', 'sms', 'email'];
const TONES: Record<OutboundStatus, StatusTone> = { pending: 'info', sent: 'success', failed: 'danger', skipped: 'neutral' };

/** Outbound queue/log (secrets never shown: masked recipient + short summary) and the integration error log. */
export function OutboundMessagesPage() {
  const { t } = useTranslation('integrations');
  const format = useFormatters();
  const [status, setStatus] = useState<OutboundStatus | ''>('');
  const [channel, setChannel] = useState<OutboundChannel | ''>('');
  const [page, setPage] = useState(1);
  const query = useOutboundMessages({ page, pageSize: DEFAULT_PAGE_SIZE, status: status || undefined, channel: channel || undefined });

  const columns = useMemo<DataTableColumn<OutboundMessageDto>[]>(() => [
    { key: 'createdAt', header: t('columns.createdAt'), cell: (row) => format.dateTime(row.createdAt) },
    { key: 'channel', header: t('columns.channel'), cell: (row) => t(`channels.${row.channel}`) },
    { key: 'kind', header: t('columns.kind'), cell: (row) => t(`kinds.${row.kind}`, { defaultValue: row.kind }) },
    { key: 'summary', header: t('columns.summary'), cell: (row) => (<>{row.summary}<br /><small>{row.recipientMasked}</small></>) },
    { key: 'status', header: t('columns.status'), cell: (row) => <StatusBadge tone={TONES[row.status]}>{t(`outboundStatus.${row.status}`)}</StatusBadge> },
    { key: 'attempts', header: t('columns.attempts'), hideOnMobile: true, cell: (row) => `${row.attempts}/${row.maxAttempts}` },
    { key: 'error', header: t('columns.lastError'), hideOnMobile: true, cell: (row) => row.lastError ?? '—' },
  ], [t, format]);

  return (
    <>
      <PageHeader title={t('title')} description={t('outbound.subtitle')} />
      <IntegrationTabs />
      <Toolbar>
        <Select
          aria-label={t('columns.status')}
          placeholder={t('filters.allStatuses')}
          value={status}
          onChange={(event) => { setStatus(event.target.value as OutboundStatus | ''); setPage(1); }}
          options={STATUSES.map((value) => ({ value, label: t(`outboundStatus.${value}`) }))}
        />
        <Select
          aria-label={t('columns.channel')}
          placeholder={t('filters.allChannels')}
          value={channel}
          onChange={(event) => { setChannel(event.target.value as OutboundChannel | ''); setPage(1); }}
          options={CHANNELS.map((value) => ({ value, label: t(`channels.${value}`) }))}
        />
      </Toolbar>
      <DataTable
        caption={t('outbound.title')}
        columns={columns}
        rows={query.data?.items}
        getRowId={(row) => row.id}
        isLoading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('outbound.empty')}
        pagination={query.data && { page, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: setPage }}
      />
      <Card title={t('errors.title')} flush>
        <IntegrationErrorsTable scope="organization" />
      </Card>
    </>
  );
}
