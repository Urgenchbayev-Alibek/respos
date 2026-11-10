using Restaurant.Domain.Common;

namespace Restaurant.Domain.Events;

/// <summary>Raised when a refund is added to a payment (owner alert for big refunds).</summary>
public sealed record PaymentRefundedDomainEvent(Guid PaymentId, Guid OrganizationId, Guid BranchId, decimal Amount, string Reason) : DomainEvent;

/// <summary>Raised when a cash shift is closed (owner alert when the cash difference is not zero).</summary>
public sealed record CashShiftClosedDomainEvent(Guid CashShiftId, Guid OrganizationId, Guid BranchId, decimal Expected, decimal Actual, decimal Difference)
    : DomainEvent;

/// <summary>Raised when a reservation is confirmed (guest confirmation SMS when SMS is enabled).</summary>
public sealed record ReservationConfirmedDomainEvent(Guid ReservationId, Guid OrganizationId, Guid BranchId) : DomainEvent;
