using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Payments;

/// <summary>Refund rules (BR-10.8): reason required, 0 &lt; amount ≤ refundable; recorded in the open shift with the payment's method.</summary>
public partial class Payment
{
    public Refund AddRefund(decimal amount, string reason, Guid cashShiftId)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainException(PaymentErrors.RefundReasonRequired);
        }

        if (amount <= 0 || amount > RefundableAmount)
        {
            throw new DomainException(PaymentErrors.InvalidRefundAmount);
        }

        RefundedAmount += amount;
        Status = RefundedAmount == Amount ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;
        var refund = new Refund
        {
            OrganizationId = OrganizationId,
            BranchId = BranchId,
            PaymentId = Id,
            CashShiftId = cashShiftId,
            Method = Method,
            Amount = amount,
            Reason = reason.Trim(),
        };
        Refunds.Add(refund);
        Raise(new PaymentRefundedDomainEvent(Id, OrganizationId, BranchId, amount, refund.Reason));
        return refund;
    }
}
