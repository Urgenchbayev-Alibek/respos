namespace Restaurant.Application.Abstractions.Payments;

public sealed record PaymentProviderRequest(Guid PaymentId, Guid OrderId, decimal Amount, string Currency, string Method, string? ExternalReference);

public sealed record PaymentProviderResult(bool Succeeded, string? ExternalReference, string? ErrorCode);

/// <summary>Payment gateway adapter. MVP: ManualPaymentProvider (UI label "manual mark (demo)").</summary>
public interface IPaymentProvider
{
    string Code { get; }

    Task<PaymentProviderResult> ChargeAsync(PaymentProviderRequest request, CancellationToken cancellationToken = default);

    Task<PaymentProviderResult> RefundAsync(PaymentProviderRequest request, CancellationToken cancellationToken = default);
}
