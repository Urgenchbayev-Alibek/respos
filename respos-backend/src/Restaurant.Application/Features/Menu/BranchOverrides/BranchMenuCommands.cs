using System.Text.Json.Serialization;
using FluentValidation;

namespace Restaurant.Application.Features.Menu.BranchOverrides;

public sealed record BranchVariantPriceDto(Guid VariantId, string VariantName, decimal BasePrice, decimal? PriceOverride, decimal EffectivePrice);

/// <summary>One branch row of the menu item × branches matrix (<c>GET /menu/items/{id}/branches</c>).</summary>
public sealed record BranchMenuItemDto(
    Guid BranchId,
    string BranchName,
    Guid MenuItemId,
    bool HasOverride,
    decimal? PriceOverride,
    bool? IsAvailable,
    Guid? KitchenStationId,
    string? KitchenStationName,
    decimal EffectivePrice,
    bool EffectiveIsAvailable,
    Guid? EffectiveKitchenStationId,
    IReadOnlyList<BranchVariantPriceDto> Variants);

public sealed record GetBranchMenuItemsQuery(Guid MenuItemId);

public sealed record BranchVariantPriceInput(Guid VariantId, decimal Price);

/// <summary>
/// <c>PUT /menu/items/{id}/branches/{branchId}</c>: replaces the branch override. All fields null and no variant prices =
/// override removed (inherit everything).
/// </summary>
public sealed record SaveBranchMenuItemCommand(
    decimal? PriceOverride,
    bool? IsAvailable,
    Guid? KitchenStationId,
    IReadOnlyList<BranchVariantPriceInput>? VariantPrices)
{
    [JsonIgnore]
    public Guid MenuItemId { get; init; }

    [JsonIgnore]
    public Guid BranchId { get; init; }
}

public sealed record ResetBranchMenuItemCommand(Guid MenuItemId, Guid BranchId);

/// <summary><c>PUT /menu/branch-availability/{menuItemId}</c>: stop-list toggle for the X-Branch-Id branch.</summary>
public sealed record SetBranchAvailabilityCommand(bool IsAvailable)
{
    [JsonIgnore]
    public Guid MenuItemId { get; init; }
}

public sealed class SaveBranchMenuItemValidator : AbstractValidator<SaveBranchMenuItemCommand>
{
    public const int MaxVariants = 50;

    public SaveBranchMenuItemValidator()
    {
        RuleFor(x => x.PriceOverride).GreaterThanOrEqualTo(0).PrecisionScale(18, 2, true);
        RuleFor(x => x.VariantPrices).Must(v => v is null || v.Count <= MaxVariants);
        RuleFor(x => x.VariantPrices)
            .Must(v => v!.Select(x => x.VariantId).Distinct().Count() == v!.Count)
            .When(x => x.VariantPrices is not null)
            .WithMessage("Duplicate variants.");
        RuleForEach(x => x.VariantPrices).ChildRules(v =>
        {
            v.RuleFor(x => x.VariantId).NotEmpty();
            v.RuleFor(x => x.Price).GreaterThanOrEqualTo(0).PrecisionScale(18, 2, true);
        });
    }
}
