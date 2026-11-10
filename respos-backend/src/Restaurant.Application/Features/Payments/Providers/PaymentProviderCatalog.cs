using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.Providers;

/// <summary>Online providers (DI) + the current branch's switches.</summary>
[ScopedService]
public sealed class PaymentProviderCatalog(IEnumerable<IOnlinePaymentProvider> providers, IApplicationDbContext db, ITenantContext tenant)
{
    public const string CallbackPathTemplate = "/api/v1/payments/providers/{0}/callback";

    public IOnlinePaymentProvider? Find(string code) =>
        providers.FirstOrDefault(p => string.Equals(p.Code, code, StringComparison.OrdinalIgnoreCase));

    public static bool IsUsable(IOnlinePaymentProvider provider) =>
        provider.IsImplemented && provider.Status != IntegrationStatus.NotConnected;

    public async Task<IReadOnlyList<PaymentProviderDto>> ListAsync(CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        var enabled = await db.BranchPaymentProviders.AsNoTracking()
            .Where(s => s.BranchId == branchId && s.IsEnabled)
            .Select(s => s.Provider)
            .ToListAsync(ct);
        return providers.Select(p =>
        {
            var isEnabled = enabled.Contains(p.Code);
            return new PaymentProviderDto(p.Code, p.IsImplemented ? p.Status : IntegrationStatus.NotConnected, p.IsImplemented,
                p.Status != IntegrationStatus.NotConnected, isEnabled, isEnabled && IsUsable(p), string.Format(null, CallbackPathTemplate, p.Code));
        }).ToList();
    }

    public async Task<bool> IsEnabledAsync(string code, CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        return await db.BranchPaymentProviders.AnyAsync(s => s.BranchId == branchId && s.Provider == code && s.IsEnabled, ct);
    }
}
