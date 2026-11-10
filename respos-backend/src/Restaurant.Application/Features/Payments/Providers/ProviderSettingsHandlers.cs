using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Fiscal;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Application.Features.Payments.Providers;

public sealed record ListPaymentProvidersQuery;

/// <summary><c>GET /payments/providers</c>: Payme / Click / Uzum with configuration status and the branch switch.</summary>
public sealed class ListPaymentProvidersHandler(PaymentProviderCatalog catalog)
    : IHandler<ListPaymentProvidersQuery, IReadOnlyList<PaymentProviderDto>>
{
    public async Task<Result<IReadOnlyList<PaymentProviderDto>>> HandleAsync(ListPaymentProvidersQuery request, CancellationToken cancellationToken) =>
        Result.Success(await catalog.ListAsync(cancellationToken));
}

public sealed record SetBranchPaymentProviderCommand(bool IsEnabled)
{
    [JsonIgnore]
    public string Code { get; init; } = string.Empty;
}

/// <summary>
/// <c>PUT /payments/providers/{code}</c> [settings.manage]: enable/disable for the current branch. Enabling requires an implemented
/// and configured provider (422 <c>payment.provider_not_configured</c>); unknown code → 404 <c>payment.provider_not_found</c>. Audited.
/// </summary>
public sealed class SetBranchPaymentProviderHandler(
    IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit, PaymentProviderCatalog catalog)
    : IHandler<SetBranchPaymentProviderCommand, IReadOnlyList<PaymentProviderDto>>
{
    public async Task<Result<IReadOnlyList<PaymentProviderDto>>> HandleAsync(SetBranchPaymentProviderCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var provider = catalog.Find(request.Code);
        if (provider is null)
        {
            return PaymentIntentErrors.ProviderNotFound;
        }

        if (request.IsEnabled && !PaymentProviderCatalog.IsUsable(provider))
        {
            return PaymentIntentErrors.ProviderNotConfigured;
        }

        var setting = await db.BranchPaymentProviders.FirstOrDefaultAsync(s => s.BranchId == branchId && s.Provider == provider.Code, cancellationToken);
        if (setting is null)
        {
            setting = new BranchPaymentProvider { BranchId = branchId, Provider = provider.Code };
            db.BranchPaymentProviders.Add(setting);
        }

        setting.IsEnabled = request.IsEnabled;
        audit.Log("payment.provider_toggled", nameof(BranchPaymentProvider), setting.Id, new { provider = provider.Code, request.IsEnabled });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success(await catalog.ListAsync(cancellationToken));
    }
}

public sealed record GetFiscalStatusQuery;

/// <summary><c>GET /payments/fiscal</c>: fiscal receipt adapter status (MVP: <c>none</c> / not_connected).</summary>
public sealed class GetFiscalStatusHandler(IFiscalProvider fiscal) : IHandler<GetFiscalStatusQuery, FiscalStatusDto>
{
    public Task<Result<FiscalStatusDto>> HandleAsync(GetFiscalStatusQuery request, CancellationToken cancellationToken) =>
        Task.FromResult(Result.Success(new FiscalStatusDto(fiscal.Code, fiscal.Status)));
}
