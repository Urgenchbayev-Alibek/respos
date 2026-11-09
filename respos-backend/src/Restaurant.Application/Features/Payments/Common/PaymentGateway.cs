using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Application.Features.Payments.Common;

/// <summary>Calls the configured <see cref="IPaymentProvider"/> (MVP: manual) with the organization currency.</summary>
[ScopedService]
public sealed class PaymentGateway(IApplicationDbContext db, ITenantContext tenant, IPaymentProvider provider)
{
    public string ProviderCode => provider.Code;

    public async Task<PaymentProviderResult> ChargeAsync(Payment payment, CancellationToken ct) =>
        await provider.ChargeAsync(await RequestAsync(payment, payment.Amount, ct), ct);

    public async Task<PaymentProviderResult> RefundAsync(Payment payment, decimal amount, CancellationToken ct) =>
        await provider.RefundAsync(await RequestAsync(payment, amount, ct), ct);

    private async Task<PaymentProviderRequest> RequestAsync(Payment payment, decimal amount, CancellationToken ct)
    {
        var orgId = tenant.RequireOrganizationId();
        var currency = await db.Organizations.AsNoTracking().Where(o => o.Id == orgId).Select(o => o.Currency).FirstAsync(ct);
        return new PaymentProviderRequest(
            payment.Id, payment.OrderId, amount, currency, payment.Method.ToString().ToLowerInvariant(), payment.ExternalReference);
    }
}
