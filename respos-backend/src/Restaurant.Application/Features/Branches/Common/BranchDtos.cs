using FluentValidation;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Branches.Common;

public sealed record BranchDto(Guid Id, string Name, string? Address, string? Phone, string Timezone, bool IsActive)
{
    /// <summary>Public QR-menu slug (<c>/menu/{slug}</c>); edited via <c>PUT /branches/{id}/delivery-settings</c>.</summary>
    public string? Slug { get; init; }

    public static BranchDto From(RestaurantBranch b) => new(b.Id, b.Name, b.Address, b.Phone, b.Timezone, b.IsActive) { Slug = b.Slug };
}

public sealed record BranchSettingsDto(
    decimal ServiceChargePercent,
    decimal TaxPercent,
    bool AllowNegativeStock,
    InventoryConsumptionTrigger InventoryConsumptionTrigger,
    string? ReceiptFooter)
{
    public static BranchSettingsDto From(BranchSettings s) =>
        new(s.ServiceChargePercent, s.TaxPercent, s.AllowNegativeStock, s.InventoryConsumptionTrigger, s.ReceiptFooter);
}

public static class BranchErrors
{
    public static readonly Error NotFound = Error.NotFound("branch.not_found", "Branch not found.");

    public static readonly Error LastActive =
        Error.BusinessRule("branch.last_active", "The last active branch cannot be deactivated.");
}

public static class BranchRules
{
    public const int AddressMaxLength = 500;
    public const int TimezoneMaxLength = 64;

    public static bool IsKnownTimezone(string? timezone) =>
        timezone is null || TimeZoneInfo.TryFindSystemTimeZoneById(timezone, out _);

    public static IRuleBuilderOptions<T, string?> ValidTimezone<T>(this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(TimezoneMaxLength).Must(IsKnownTimezone).WithMessage("Unknown timezone.");
}
