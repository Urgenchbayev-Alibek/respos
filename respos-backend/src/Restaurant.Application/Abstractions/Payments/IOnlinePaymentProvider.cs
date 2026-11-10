using Restaurant.Domain.Enums;

namespace Restaurant.Application.Abstractions.Payments;

/// <summary>Data for the customer payment link / QR (amount includes the tip).</summary>
public sealed record PaymentLinkRequest(Guid IntentId, decimal TotalAmount, string Currency);

/// <summary>Raw inbound provider callback (no JWT): headers needed for verification + body or form fields.</summary>
public sealed record ProviderCallbackRequest(string? Authorization, string Body, IReadOnlyDictionary<string, string> Form);

/// <summary>Protocol response written as-is (providers expect HTTP 200 with their own error format).</summary>
public sealed record ProviderCallbackResponse(int StatusCode, string Body, string ContentType = "application/json");

/// <summary>
/// Online payment provider (Payme, Click, Uzum) behind <see cref="IPaymentProvider"/>. Customer-initiated: the cashier creates
/// a payment intent with a link/QR, the provider confirms via <see cref="HandleCallbackAsync"/>. Disabled unless configured (env).
/// <see cref="IPaymentProvider.ChargeAsync"/> is not used for these providers (always fails with <c>payment.provider_async</c>).
/// </summary>
public interface IOnlinePaymentProvider : IPaymentProvider
{
    /// <summary>NotConnected when credentials are missing (or the adapter is a skeleton); Test / Connected otherwise.</summary>
    PaymentProviderStatus Status { get; }

    /// <summary>False for adapter skeletons that must not be enabled (Uzum).</summary>
    bool IsImplemented { get; }

    string CreatePaymentUrl(PaymentLinkRequest request);

    Task<ProviderCallbackResponse> HandleCallbackAsync(ProviderCallbackRequest request, CancellationToken cancellationToken);
}
