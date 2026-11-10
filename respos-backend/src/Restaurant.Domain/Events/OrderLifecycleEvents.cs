using Restaurant.Domain.Common;

namespace Restaurant.Domain.Events;

/// <summary>Raised when an order is cancelled (e.g. loyalty points redeemed on it are returned).</summary>
public sealed record OrderCancelledDomainEvent(Guid OrderId, Guid BranchId) : DomainEvent;

/// <summary>Raised when money is refunded on an order (<see cref="Amount"/> of this refund; order paidAmount already reduced).</summary>
public sealed record OrderRefundedDomainEvent(Guid OrderId, Guid BranchId, decimal Amount) : DomainEvent;
