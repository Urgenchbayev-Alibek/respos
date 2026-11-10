namespace Restaurant.Domain.Enums;

public enum CustomerGender { Male, Female }

/// <summary>Ledger entry kind. Points are signed: earn/return positive, redeem/expire/earn-reversal negative.</summary>
public enum LoyaltyTransactionType { Earn, Redeem, Expire, Reverse }

/// <summary>Why a ledger entry was written (lets reversals be computed idempotently per order).</summary>
public enum LoyaltyReason { OrderPaid, OrderRedeemed, RedemptionCancelled, OrderCancelled, Refund, Reconcile, Expiry }
