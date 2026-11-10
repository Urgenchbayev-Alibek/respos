import { z } from 'zod';
import type { IntegrationConfigByType, IntegrationDto, IntegrationType } from '@/entities/integration/integration.types';
import { V } from '@/shared/lib/validation';

export type FieldKind = 'text' | 'secret' | 'email' | 'number' | 'time' | 'switch' | 'list';

export interface FieldDescriptor {
  name: string;
  kind: FieldKind;
  /** Required when the integration is enabled. */
  required?: boolean;
  /** Hint key in the `integrations` namespace. */
  hint?: boolean;
}

/** Form layout per integration (labels: `integrations:fields.<type>.<name>`). */
export const INTEGRATION_FIELDS: Record<IntegrationType, FieldDescriptor[]> = {
  telegram: [
    { name: 'botToken', kind: 'secret', required: true, hint: true },
    { name: 'chatIds', kind: 'list', required: true, hint: true },
    { name: 'dailySummaryEnabled', kind: 'switch' },
    { name: 'dailySummaryTime', kind: 'time', hint: true },
    { name: 'lowStockEnabled', kind: 'switch' },
    { name: 'onlineReservationEnabled', kind: 'switch' },
    { name: 'shiftDifferenceEnabled', kind: 'switch' },
    { name: 'bigRefundEnabled', kind: 'switch' },
    { name: 'bigRefundThreshold', kind: 'number' },
  ],
  sms_eskiz: [
    { name: 'email', kind: 'email', required: true },
    { name: 'password', kind: 'secret', required: true },
    { name: 'from', kind: 'text', hint: true },
    { name: 'reservationConfirmationEnabled', kind: 'switch' },
  ],
  smtp: [
    { name: 'host', kind: 'text', required: true },
    { name: 'port', kind: 'number' },
    { name: 'useSsl', kind: 'switch', hint: true },
    { name: 'username', kind: 'text' },
    { name: 'password', kind: 'secret' },
    { name: 'fromEmail', kind: 'email', required: true },
    { name: 'fromName', kind: 'text' },
  ],
};

export type IntegrationFormValues = { isEnabled: boolean } & Record<string, string | boolean>;

/** DTO config → flat form values (lists joined with commas, numbers as strings). */
export function toFormValues(integration: IntegrationDto): IntegrationFormValues {
  const config = integration.config as unknown as Record<string, unknown>;
  const values: IntegrationFormValues = { isEnabled: integration.isEnabled };
  for (const field of INTEGRATION_FIELDS[integration.type]) {
    const raw = config[field.name];
    if (field.kind === 'switch') values[field.name] = Boolean(raw);
    else if (field.kind === 'list') values[field.name] = Array.isArray(raw) ? raw.join(', ') : '';
    else values[field.name] = raw === null || raw === undefined ? '' : String(raw);
  }
  return values;
}

/** Form values → request config (secrets left as typed: empty or masked keeps the stored value). */
export function toConfig<T extends IntegrationType>(type: T, values: IntegrationFormValues): IntegrationConfigByType[T] {
  const config: Record<string, unknown> = {};
  for (const field of INTEGRATION_FIELDS[type]) {
    const value = values[field.name];
    if (field.kind === 'switch') config[field.name] = Boolean(value);
    else if (field.kind === 'number') config[field.name] = Number(value || 0);
    else if (field.kind === 'list')
      config[field.name] = String(value ?? '')
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    else config[field.name] = String(value ?? '').trim() || null;
  }
  return config as unknown as IntegrationConfigByType[T];
}

/** Required-when-enabled + per-kind format checks (server validates again). */
export function integrationSchema(type: IntegrationType) {
  return z
    .object({ isEnabled: z.boolean() })
    .catchall(z.union([z.string(), z.boolean()]))
    .superRefine((values, ctx) => {
      for (const field of INTEGRATION_FIELDS[type]) {
        const value = values[field.name];
        const text = typeof value === 'string' ? value.trim() : '';
        if (field.required && values.isEnabled && !text) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field.name], message: V.required });
        } else if (field.kind === 'email' && text && !z.string().email().safeParse(text).success) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field.name], message: V.email });
        } else if (field.kind === 'time' && text && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field.name], message: 'integrations:validation.time' });
        } else if (field.kind === 'number' && text && (Number.isNaN(Number(text)) || Number(text) < 0)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field.name], message: V.nonNegative });
        }
      }
    });
}
