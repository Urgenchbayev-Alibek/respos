import type { PageParams } from '@/shared/types/pagination';

/** respos-contracts/v2/F7-integrations.md */
export const INTEGRATION_TYPES = ['telegram', 'sms_eskiz', 'smtp'] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export type IntegrationStatus = 'not_configured' | 'connected' | 'error';

/** Secrets come back masked (`****abcd`); sending them back unchanged (or empty) keeps the stored value. */
export interface TelegramConfig {
  botToken: string | null;
  chatIds: string[];
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  lowStockEnabled: boolean;
  bigRefundEnabled: boolean;
  bigRefundThreshold: number;
  onlineReservationEnabled: boolean;
  shiftDifferenceEnabled: boolean;
}

export interface EskizConfig {
  email: string | null;
  password: string | null;
  from: string;
  reservationConfirmationEnabled: boolean;
}

export interface SmtpConfig {
  host: string | null;
  port: number;
  useSsl: boolean;
  username: string | null;
  password: string | null;
  fromEmail: string | null;
  fromName: string | null;
}

export interface IntegrationConfigByType {
  telegram: TelegramConfig;
  sms_eskiz: EskizConfig;
  smtp: SmtpConfig;
}

export interface IntegrationDto<T extends IntegrationType = IntegrationType> {
  type: T;
  isEnabled: boolean;
  status: IntegrationStatus;
  isConfigured: boolean;
  config: IntegrationConfigByType[T];
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

export interface IntegrationTestResultDto {
  success: boolean;
  error: string | null;
  integration: IntegrationDto;
}

export type OutboundChannel = 'telegram' | 'sms' | 'email';
export type OutboundStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface OutboundMessageDto {
  id: string;
  channel: OutboundChannel;
  kind: string;
  recipientMasked: string;
  summary: string;
  status: OutboundStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  branchId: string | null;
}

export interface IntegrationErrorDto {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  integrationType: IntegrationType | null;
  channel: OutboundChannel | null;
  operation: string;
  message: string;
  outboundMessageId: string | null;
  createdAt: string;
}

export interface OutboundListParams extends PageParams {
  status?: OutboundStatus;
  channel?: OutboundChannel;
}

export interface IntegrationErrorListParams extends PageParams {
  type?: IntegrationType;
  organizationId?: string;
}
