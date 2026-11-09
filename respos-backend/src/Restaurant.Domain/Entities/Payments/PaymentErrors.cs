using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Payments;

public static class PaymentErrors
{
    public static readonly Error NotFound = Error.NotFound("payment.not_found", "Payment not found.");
    public static readonly Error Duplicate = Error.Conflict("payment.duplicate", "A payment with this Idempotency-Key already exists.");
    public static readonly Error ProviderFailed = Error.BusinessRule("payment.provider_failed", "The payment provider rejected the operation.");
    public static readonly Error InvalidRefundAmount =
        Error.BusinessRule("payment.invalid_refund_amount", "Refund amount must be greater than zero and not exceed the refundable amount.");
    public static readonly Error RefundReasonRequired = Error.Validation("payment.refund_reason_required", "Refund reason is required.");
}

public static class CashShiftErrors
{
    public static readonly Error NotFound = Error.NotFound("cash_shift.not_found", "Cash shift not found.");
    public static readonly Error NotOpen = Error.BusinessRule("cash_shift.not_open", "Open a cash shift first.");
    public static readonly Error AlreadyOpen = Error.Conflict("cash_shift.already_open", "A cash shift is already open in this branch.");
    public static readonly Error Closed = Error.Conflict("cash_shift.closed", "The cash shift is already closed.");
    public static readonly Error InvalidAmount = Error.Validation("cash_shift.invalid_amount", "Amount must not be negative.");
}
