using FluentValidation;

namespace Restaurant.Application.Features.Procurement.Suggestions;

/// <summary>
/// <c>GET /purchases/suggestions?coverageDays=7&amp;lookbackDays=14</c>. All quantities in the ingredient base unit:
/// <c>avgDaily = consumption(lookbackDays) / lookbackDays</c>, <c>target = min + avgDaily × coverageDays</c>,
/// <c>suggested = ceil₃(target − current − onOrder)</c>; only lines with suggested &gt; 0.
/// </summary>
public sealed record GetPurchaseSuggestionsQuery
{
    public const int DefaultLookbackDays = 14;

    public int CoverageDays { get; init; }
    public int LookbackDays { get; init; } = DefaultLookbackDays;
}

public sealed record PurchaseSuggestionLineDto(
    Guid IngredientId,
    string IngredientName,
    Guid BaseUnitId,
    string BaseUnitCode,
    decimal CurrentQuantity,
    decimal MinQuantity,
    decimal OnOrderQuantity,
    decimal AvgDailyConsumption,
    decimal TargetQuantity,
    decimal SuggestedQuantity,
    decimal LastPrice,
    decimal EstimatedTotal);

/// <summary>Group of lines by the ingredients' default supplier; <c>supplierId</c> null = no (active) default supplier.</summary>
public sealed record PurchaseSuggestionGroupDto(Guid? SupplierId, string? SupplierName, decimal EstimatedTotal, IReadOnlyList<PurchaseSuggestionLineDto> Lines);

public sealed record PurchaseSuggestionsDto(int CoverageDays, int LookbackDays, IReadOnlyList<PurchaseSuggestionGroupDto> Groups);

/// <summary>Line to order: base unit of the ingredient; <c>unitPrice</c> null = ingredient CostPrice.</summary>
public sealed record ApplySuggestionLine(Guid IngredientId, Guid SupplierId, decimal Quantity, decimal? UnitPrice);

/// <summary><c>POST /purchases/suggestions/apply</c>: one draft purchase order per supplier, all or nothing.</summary>
public sealed record ApplyPurchaseSuggestionsCommand(IReadOnlyList<ApplySuggestionLine> Lines, DateTime? ExpectedAt, string? Comment);

public sealed class GetPurchaseSuggestionsValidator : AbstractValidator<GetPurchaseSuggestionsQuery>
{
    public const int MaxDays = 90;

    public GetPurchaseSuggestionsValidator()
    {
        RuleFor(x => x.CoverageDays).InclusiveBetween(0, MaxDays);
        RuleFor(x => x.LookbackDays).InclusiveBetween(1, MaxDays);
    }
}

public sealed class ApplyPurchaseSuggestionsValidator : AbstractValidator<ApplyPurchaseSuggestionsCommand>
{
    public const int MaxLines = 500;

    public ApplyPurchaseSuggestionsValidator()
    {
        RuleFor(x => x.Comment).MaximumLength(1000);
        RuleFor(x => x.Lines).NotEmpty().Must(l => l is null || l.Count <= MaxLines);
        RuleFor(x => x.Lines)
            .Must(l => l.Select(x => (x.IngredientId, x.SupplierId)).Distinct().Count() == l.Count)
            .When(x => x.Lines is not null)
            .WithMessage("Duplicate lines.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.IngredientId).NotEmpty();
            line.RuleFor(l => l.SupplierId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).PrecisionScale(18, 3, true);
            line.RuleFor(l => l.UnitPrice).GreaterThanOrEqualTo(0).PrecisionScale(18, 2, true);
        });
    }
}
