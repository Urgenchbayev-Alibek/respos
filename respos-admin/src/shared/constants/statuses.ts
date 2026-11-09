/**
 * Status enums (snake_case, per CONVENTIONS.md) and their visual tone — ONE map for the whole app.
 * Labels live in i18n namespace `status` under `<domain>.<value>`, e.g. t('status:order.in_progress').
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';

export const ORDER_STATUSES = [
  'draft', 'submitted', 'in_progress', 'partially_ready', 'ready', 'served', 'paid', 'cancelled',
] as const;
export const ORDER_ITEM_STATUSES = ['new', 'sent', 'preparing', 'ready', 'served', 'cancelled'] as const;
export const TABLE_STATUSES = ['available', 'occupied', 'reserved', 'unavailable'] as const;
export const TICKET_STATUSES = ['new', 'in_progress', 'ready', 'served', 'cancelled'] as const;
export const RESERVATION_STATUSES = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'] as const;
export const USER_STATUSES = ['active', 'invited', 'blocked', 'deactivated'] as const;
export const PURCHASE_STATUSES = ['draft', 'submitted', 'partially_received', 'received', 'cancelled'] as const;
export const PAYMENT_STATUSES = ['completed', 'refunded', 'partially_refunded'] as const;
export const CASH_SHIFT_STATUSES = ['open', 'closed'] as const;
export const ORGANIZATION_STATUSES = ['active', 'suspended', 'closed'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];
export type TableStatus = (typeof TABLE_STATUSES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type CashShiftStatus = (typeof CASH_SHIFT_STATUSES)[number];
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const STATUS_TONES = {
  order: {
    draft: 'neutral', submitted: 'info', in_progress: 'warning', partially_ready: 'primary',
    ready: 'success', served: 'neutral', paid: 'success', cancelled: 'danger',
  } satisfies Record<OrderStatus, StatusTone>,
  orderItem: {
    new: 'neutral', sent: 'info', preparing: 'warning', ready: 'success', served: 'neutral', cancelled: 'danger',
  } satisfies Record<OrderItemStatus, StatusTone>,
  table: {
    available: 'success', occupied: 'primary', reserved: 'info', unavailable: 'neutral',
  } satisfies Record<TableStatus, StatusTone>,
  ticket: {
    new: 'info', in_progress: 'warning', ready: 'success', served: 'neutral', cancelled: 'danger',
  } satisfies Record<TicketStatus, StatusTone>,
  reservation: {
    pending: 'warning', confirmed: 'info', seated: 'primary', completed: 'success', cancelled: 'neutral', no_show: 'danger',
  } satisfies Record<ReservationStatus, StatusTone>,
  user: {
    active: 'success', invited: 'info', blocked: 'danger', deactivated: 'neutral',
  } satisfies Record<UserStatus, StatusTone>,
  purchase: {
    draft: 'neutral', submitted: 'info', partially_received: 'warning', received: 'success', cancelled: 'danger',
  } satisfies Record<PurchaseStatus, StatusTone>,
  payment: {
    completed: 'success', refunded: 'danger', partially_refunded: 'warning',
  } satisfies Record<PaymentStatus, StatusTone>,
  cashShift: { open: 'success', closed: 'neutral' } satisfies Record<CashShiftStatus, StatusTone>,
  organization: { active: 'success', suspended: 'warning', closed: 'neutral' } satisfies Record<OrganizationStatus, StatusTone>,
} as const;

export type StatusDomain = keyof typeof STATUS_TONES;

export function getStatusTone(domain: StatusDomain, status: string): StatusTone {
  const tones = STATUS_TONES[domain] as Record<string, StatusTone>;
  return tones[status] ?? 'neutral';
}
