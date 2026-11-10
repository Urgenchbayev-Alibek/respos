using Restaurant.Application.Abstractions.Payments;

namespace Restaurant.Infrastructure.Payments;

/// <summary>
/// Online providers are customer-initiated (payment link/QR + callback): synchronous charge/refund through
/// <see cref="IPaymentProvider"/> is not supported and fails honestly (no fake success).
/// </summary>
internal abstract class OnlineProviderBase : IPaymentProvider
{
    public const string AsyncOnlyError = "payment.provider_async";

    public abstract string Code { get; }

    public Task<PaymentProviderResult> ChargeAsync(PaymentProviderRequest request, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PaymentProviderResult(false, null, AsyncOnlyError));

    public Task<PaymentProviderResult> RefundAsync(PaymentProviderRequest request, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PaymentProviderResult(false, null, AsyncOnlyError));
}
