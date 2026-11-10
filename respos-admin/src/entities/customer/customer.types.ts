import type { OrderStatus } from '@/shared/constants/statuses';
import type { Guid, Iso8601 } from '@/shared/types/api-response';
import type { PageParams } from '@/shared/types/pagination';

/** Backend `Customers/Common/CustomerDtos.cs` (respos-contracts/v2/F1-crm.md). */
export const CUSTOMER_SEGMENTS = ['new', 'regular', 'sleeping', 'birthday', 'vip'] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export type CustomerGender = 'male' | 'female';

export interface CustomerListItemDto {
  id: Guid;
  name: string;
  phone: string;
  birthday: string | null;
  tags: string[];
  isVip: boolean;
  isBirthdayToday: boolean;
  isBirthdaySoon: boolean;
  visits: number;
  totalSpent: number;
  averageCheck: number;
  lastVisitAt: Iso8601 | null;
  points: number;
  createdAt: Iso8601;
}

export interface CustomerDto {
  id: Guid;
  name: string;
  phone: string;
  birthday: string | null;
  gender: CustomerGender | null;
  notes: string | null;
  tags: string[];
  marketingConsent: boolean;
  isVip: boolean;
  isBirthdayToday: boolean;
  isBirthdaySoon: boolean;
  createdAt: Iso8601;
  stats: { visits: number; totalSpent: number; averageCheck: number; lastVisitAt: Iso8601 | null };
  loyalty: { points: number; lifetimeEarned: number; lifetimeRedeemed: number };
}

/** `OrderDto.customer` summary. */
export interface OrderCustomerDto {
  id: Guid;
  name: string;
  phone: string;
  isBirthdayToday: boolean;
  isVip: boolean;
  points: number;
}

export interface CustomerOrderDto {
  id: Guid;
  number: number;
  branchId: Guid;
  branchName: string | null;
  businessDate: string;
  type: string;
  status: OrderStatus;
  total: number;
  paidAmount: number;
  loyaltyDiscountAmount: number;
  openedAt: Iso8601;
  closedAt: Iso8601 | null;
}

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'reverse';
export type LoyaltyReason =
  | 'order_paid'
  | 'order_redeemed'
  | 'redemption_cancelled'
  | 'order_cancelled'
  | 'refund'
  | 'reconcile'
  | 'expiry';

export interface LoyaltyTransactionDto {
  id: Guid;
  type: LoyaltyTransactionType;
  reason: LoyaltyReason;
  points: number;
  balanceAfter: number;
  orderId: Guid | null;
  orderNumber: number | null;
  expiresAt: Iso8601 | null;
  createdAt: Iso8601;
  createdByName: string | null;
}

export interface LoyaltySettingsDto {
  isEnabled: boolean;
  earnPercent: number;
  maxRedeemPercent: number;
  minOrderAmount: number;
  pointsExpiryDays: number | null;
}

export interface OrderLoyaltyDto {
  isEnabled: boolean;
  customerId: Guid | null;
  points: number;
  maxRedeemable: number;
  redeemed: number;
  expectedEarn: number;
  minOrderAmount: number;
  maxRedeemPercent: number;
}

export interface CustomerListParams extends PageParams {
  segment?: CustomerSegment;
  tag?: string;
}

export interface CustomerInput {
  phone: string;
  name: string;
  birthday?: string | null;
  gender?: CustomerGender | null;
  notes?: string | null;
  tags?: string[];
  marketingConsent: boolean;
}
