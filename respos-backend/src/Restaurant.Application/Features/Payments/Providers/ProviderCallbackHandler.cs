using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Application.Features.Payments.Providers;

public sealed record ProviderCallbackCommand(string Provider, ProviderCallbackRequest Request);

/// <summary>
/// <c>POST /payments/providers/{name}/callback</c> (anonymous): unknown or unconfigured provider → 404 (nothing to probe);
/// otherwise the adapter verifies auth/signature, processes idempotently and writes its own protocol response.
/// </summary>
public sealed class ProviderCallbackHandler(PaymentProviderCatalog catalog) : IHandler<ProviderCallbackCommand, ProviderCallbackResponse>
{
    public async Task<Result<ProviderCallbackResponse>> HandleAsync(ProviderCallbackCommand request, CancellationToken cancellationToken)
    {
        var provider = catalog.Find(request.Provider);
        if (provider is null || !PaymentProviderCatalog.IsUsable(provider))
        {
            return PaymentIntentErrors.ProviderNotFound;
        }

        return await provider.HandleCallbackAsync(request.Request, cancellationToken);
    }
}
