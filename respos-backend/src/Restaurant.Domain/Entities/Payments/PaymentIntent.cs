using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Payments;

/// <summary>
/// Provider-initiated payment (Payme / Click / Uzum) that is <c>pending</c> until the provider callback confirms it.
/// Only a confirmed intent creates a <see cref="Payment"/> (so shift/report sums never include unconfirmed money).
/// <see cref="ProviderState"/> follows Payme states: 0 none, 1 created, 2 performed, −1 cancelled, −2 cancelled after perform.
/// </summary>
public class PaymentIntent : AuditableEntity, IBranchScoped
{
    public const int StateNone = 0;
    public const int StateCreated = 1;
    public const int StatePerformed = 2;
    public const int StateCancelled = -1;

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid OrderId { get; set; }
    public Guid? BillId { get; set; }
    public Guid CashShiftId { get; set; }
    public string Provider { get; set; } = string.Empty;

    /// <summary>Amount applied to the order/bill (excludes the tip).</summary>
    public decimal Amount { get; set; }
    public decimal TipAmount { get; set; }
    public PaymentIntentStatus Status { get; private set; } = PaymentIntentStatus.Pending;
    public DateTime ExpiresAt { get; set; }
    public string? PaymentUrl { get; set; }

    public string? ProviderTransactionId { get; private set; }

    /// <summary>Provider-side transaction time (Payme <c>time</c>, ms since epoch) — used by GetStatement.</summary>
    public long? ProviderTime { get; private set; }

    /// <summary>Click <c>merchant_prepare_id</c>.</summary>
    public long? ProviderPrepareId { get; private set; }
    public int ProviderState { get; private set; }
    public DateTime? ProviderCreatedAt { get; private set; }
    public DateTime? PerformedAt { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public int? CancelReason { get; private set; }
    public Guid? PaymentId { get; private set; }

    /// <summary>Concurrency token mapped to Postgres <c>xmin</c> (parallel provider retries).</summary>
    public uint RowVersion { get; private set; }

    public decimal TotalAmount => Amount + TipAmount;

    /// <summary>Blocks other payments of the same order/bill while the customer may still pay.</summary>
    public bool IsActive(DateTime utcNow) =>
        Status == PaymentIntentStatus.Pending && (ExpiresAt > utcNow || ProviderState == StateCreated);

    /// <summary>Provider created its transaction (Payme CreateTransaction / Click Prepare).</summary>
    public void AttachTransaction(string transactionId, long? providerTime, long? prepareId, DateTime utcNow, bool allowReplace = false)
    {
        EnsurePending();
        if (ProviderTransactionId is not null && ProviderTransactionId != transactionId && !allowReplace)
        {
            throw new DomainException(PaymentIntentErrors.TransactionMismatch);
        }

        ProviderTransactionId = transactionId;
        ProviderTime = providerTime;
        ProviderPrepareId = prepareId;
        ProviderCreatedAt = utcNow;
        ProviderState = StateCreated;
    }

    public void MarkCompleted(Guid paymentId, DateTime utcNow)
    {
        EnsurePending();
        Status = PaymentIntentStatus.Completed;
        PaymentId = paymentId;
        PerformedAt = utcNow;
        ProviderState = StatePerformed;
    }

    /// <summary>Cancels a pending intent (cashier, provider cancel, timeout). No-op when already cancelled.</summary>
    public void Cancel(int? reason, DateTime utcNow)
    {
        if (Status == PaymentIntentStatus.Cancelled)
        {
            return;
        }

        EnsurePending();
        Status = PaymentIntentStatus.Cancelled;
        CancelledAt = utcNow;
        CancelReason = reason;
        ProviderState = StateCancelled;
    }

    private void EnsurePending()
    {
        if (Status != PaymentIntentStatus.Pending)
        {
            throw new DomainException(PaymentIntentErrors.NotPending);
        }
    }
}

/// <summary>Per-branch switch for an online provider; effective only when the provider is configured (env).</summary>
public class BranchPaymentProvider : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public bool IsEnabled { get; set; }
}

public static class PaymentIntentErrors
{
    public static readonly Error NotFound = Error.NotFound("payment.intent_not_found", "Payment intent not found.");
    public static readonly Error NotPending = Error.Conflict("payment.intent_not_pending", "The payment intent is not pending.");
    public static readonly Error Pending =
        Error.Conflict("payment.intent_pending", "An online payment is pending for this order/bill; wait or cancel it first.");
    public static readonly Error TransactionMismatch =
        Error.Conflict("payment.intent_transaction_mismatch", "The intent is bound to another provider transaction.");
    public static readonly Error ProviderNotFound = Error.NotFound("payment.provider_not_found", "Payment provider not found.");
    public static readonly Error ProviderNotConfigured =
        Error.BusinessRule("payment.provider_not_configured", "The payment provider is not configured on the server.");
    public static readonly Error ProviderNotEnabled =
        Error.BusinessRule("payment.provider_not_enabled", "The payment provider is not enabled for this branch.");
    public static readonly Error NothingDue = Error.BusinessRule("payment.nothing_due", "Nothing is left to pay.");
}
