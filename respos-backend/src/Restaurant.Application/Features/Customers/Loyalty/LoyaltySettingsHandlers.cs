using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Customers.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Customers;

namespace Restaurant.Application.Features.Customers.Loyalty;

public sealed record GetLoyaltySettingsQuery;

public sealed record UpdateLoyaltySettingsCommand(
    bool IsEnabled, decimal EarnPercent, decimal MaxRedeemPercent, decimal MinOrderAmount, int? PointsExpiryDays);

public sealed class UpdateLoyaltySettingsValidator : AbstractValidator<UpdateLoyaltySettingsCommand>
{
    public UpdateLoyaltySettingsValidator()
    {
        RuleFor(x => x.EarnPercent).InclusiveBetween(0m, 100m).PrecisionScale(5, 2, true);
        RuleFor(x => x.MaxRedeemPercent).InclusiveBetween(0m, 100m).PrecisionScale(5, 2, true);
        RuleFor(x => x.MinOrderAmount).GreaterThanOrEqualTo(0m).PrecisionScale(18, 2, true);
        RuleFor(x => x.PointsExpiryDays).InclusiveBetween(1, LoyaltySettings.MaxExpiryDays);
    }
}

public static class LoyaltySettingsMapper
{
    public static LoyaltySettingsDto ToDto(LoyaltySettings s) =>
        new(s.IsEnabled, s.EarnPercent, s.MaxRedeemPercent, s.MinOrderAmount, s.PointsExpiryDays);
}

/// <summary><c>GET /loyalty/settings</c> (org): defaults (disabled) until saved.</summary>
public sealed class GetLoyaltySettingsHandler(ITenantContext tenant, LoyaltyLedger ledger) : IHandler<GetLoyaltySettingsQuery, LoyaltySettingsDto>
{
    public async Task<Result<LoyaltySettingsDto>> HandleAsync(GetLoyaltySettingsQuery request, CancellationToken cancellationToken) =>
        LoyaltySettingsMapper.ToDto(await ledger.GetSettingsAsync(tenant.RequireOrganizationId(), cancellationToken));
}

/// <summary><c>PUT /loyalty/settings</c> [customers.manage]: upsert; audited with before/after.</summary>
public sealed class UpdateLoyaltySettingsHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<UpdateLoyaltySettingsCommand, LoyaltySettingsDto>
{
    public async Task<Result<LoyaltySettingsDto>> HandleAsync(UpdateLoyaltySettingsCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var settings = await db.LoyaltySettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            settings = LoyaltySettings.Default(orgId);
            db.LoyaltySettings.Add(settings);
        }

        var before = LoyaltySettingsMapper.ToDto(settings);
        settings.Update(request.IsEnabled, request.EarnPercent, request.MaxRedeemPercent, request.MinOrderAmount, request.PointsExpiryDays);
        var after = LoyaltySettingsMapper.ToDto(settings);
        audit.Log("loyalty.settings_updated", nameof(LoyaltySettings), settings.Id, new { before, after });
        await db.SaveChangesAsync(cancellationToken);
        return after;
    }
}
