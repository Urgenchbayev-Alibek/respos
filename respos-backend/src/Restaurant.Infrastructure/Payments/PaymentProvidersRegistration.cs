using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Fiscal;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Common.Options;
using Restaurant.Infrastructure.Context;

namespace Restaurant.Infrastructure.Payments;

public static class PaymentProvidersRegistration
{
    /// <summary>F2: online payment providers (Payme, Click, Uzum skeleton), fiscal adapter (none), callback tenant scope.</summary>
    public static IServiceCollection AddPaymentProviders(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<PaymentProvidersOptions>(configuration.GetSection(PaymentProvidersOptions.SectionName));
        services.AddScoped<IOnlinePaymentProvider, PaymeProvider>();
        services.AddScoped<IOnlinePaymentProvider, ClickProvider>();
        services.AddScoped<IOnlinePaymentProvider, UzumProvider>();
        services.AddSingleton<IFiscalProvider, NoFiscalProvider>();
        services.AddScoped<ITenantScopeOverride, TenantScopeOverride>();
        return services;
    }
}

/// <summary>Sets org + branch on the request context for a verified provider callback (anonymous requests only).</summary>
internal sealed class TenantScopeOverride(RequestContext context) : ITenantScopeOverride
{
    public void Enter(Guid organizationId, Guid branchId)
    {
        if (context.UserId is not null || (context.OrganizationId is { } current && current != organizationId))
        {
            throw new InvalidOperationException("Tenant scope override is only allowed for anonymous requests without a tenant.");
        }

        context.SetOrganization(organizationId);
        context.SetBranch(branchId);
    }
}
