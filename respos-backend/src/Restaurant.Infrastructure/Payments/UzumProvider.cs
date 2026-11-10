using System.Text.Json.Nodes;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Infrastructure.Payments;

/// <summary>
/// Uzum (Uzum Bank merchant / checkout) — ADAPTER SKELETON, DISABLED. Its public merchant API could not be verified against
/// official documentation for this release, so the adapter never reports itself as connected, cannot be enabled for a
/// branch, and its callback answers 501. Implement after the merchant contract + sandbox access (User-Todo / ADR-0008).
/// </summary>
internal sealed class UzumProvider : OnlineProviderBase, IOnlinePaymentProvider
{
    public const string ProviderCode = "uzum";

    public override string Code => ProviderCode;

    public IntegrationStatus Status => IntegrationStatus.NotConnected;

    public bool IsImplemented => false;

    public string CreatePaymentUrl(PaymentLinkRequest request) =>
        throw new InvalidOperationException("The Uzum adapter is a skeleton and cannot create payment links.");

    public Task<ProviderCallbackResponse> HandleCallbackAsync(ProviderCallbackRequest request, CancellationToken cancellationToken) =>
        Task.FromResult(new ProviderCallbackResponse(501, new JsonObject { ["error"] = "not_implemented" }.ToJsonString()));
}
