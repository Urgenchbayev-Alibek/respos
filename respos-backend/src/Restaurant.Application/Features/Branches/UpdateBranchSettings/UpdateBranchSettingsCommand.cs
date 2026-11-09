using System.Text.Json.Serialization;
using FluentValidation;

namespace Restaurant.Application.Features.Branches.UpdateBranchSettings;

public sealed record UpdateBranchSettingsCommand(
    decimal ServiceChargePercent, decimal TaxPercent, bool AllowNegativeStock, string? ReceiptFooter)
{
    /// <summary>Branch id from the route.</summary>
    [JsonIgnore]
    public Guid BranchId { get; init; }
}

public sealed class UpdateBranchSettingsValidator : AbstractValidator<UpdateBranchSettingsCommand>
{
    public const int ReceiptFooterMaxLength = 1000;

    public UpdateBranchSettingsValidator()
    {
        RuleFor(x => x.ServiceChargePercent).InclusiveBetween(0m, 100m).PrecisionScale(5, 2, true);
        RuleFor(x => x.TaxPercent).InclusiveBetween(0m, 100m).PrecisionScale(5, 2, true);
        RuleFor(x => x.ReceiptFooter).MaximumLength(ReceiptFooterMaxLength);
    }
}
