using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.Providers;

/// <summary>
/// Provider state for the current branch. <c>status</c> = server configuration (not_connected | test | connected);
/// <c>isEnabled</c> = branch switch; <c>isAvailable</c> = usable at the cashier (implemented + configured + enabled).
/// </summary>
public sealed record PaymentProviderDto(
    string Code,
    IntegrationStatus Status,
    bool IsImplemented,
    bool IsConfigured,
    bool IsEnabled,
    bool IsAvailable,
    string CallbackPath);

public sealed record FiscalStatusDto(string Code, IntegrationStatus Status);

/// <summary>Provider-initiated payment. <c>paymentUrl</c> is also the QR payload. <c>totalAmount = amount + tipAmount</c>.</summary>
public sealed record PaymentIntentDto(
    Guid Id,
    Guid OrderId,
    Guid? BillId,
    string Provider,
    decimal Amount,
    decimal TipAmount,
    decimal TotalAmount,
    PaymentIntentStatus Status,
    bool IsExpired,
    string? PaymentUrl,
    DateTime ExpiresAt,
    Guid? PaymentId,
    DateTime CreatedAt)
{
    public static PaymentIntentDto From(PaymentIntent i, DateTime utcNow) => new(
        i.Id, i.OrderId, i.BillId, i.Provider, i.Amount, i.TipAmount, i.TotalAmount, i.Status,
        i.Status == PaymentIntentStatus.Pending && !i.IsActive(utcNow), i.PaymentUrl, i.ExpiresAt, i.PaymentId, i.CreatedAt);
}
