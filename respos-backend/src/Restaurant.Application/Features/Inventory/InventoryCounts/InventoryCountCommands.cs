using FluentValidation;
using Restaurant.Application.Common.Models;

namespace Restaurant.Application.Features.Inventory.InventoryCounts;

public sealed record ListInventoryCountsQuery : PageQuery;

public sealed record GetInventoryCountQuery(Guid Id);

/// <summary>Snapshots expected quantities of the given (default: all active) ingredients in the current branch.</summary>
public sealed record CreateInventoryCountCommand(string? Comment, IReadOnlyList<Guid>? IngredientIds);

public sealed record CountedLine(Guid IngredientId, decimal? CountedQty);

/// <summary>Sets counted quantities; an ingredient not yet in the count is added with its current balance as expected.</summary>
public sealed record UpdateInventoryCountCommand(IReadOnlyList<CountedLine> Lines)
{
    public Guid Id { get; init; }
}

public sealed record CompleteInventoryCountCommand(Guid Id);

public sealed class CreateInventoryCountValidator : AbstractValidator<CreateInventoryCountCommand>
{
    public CreateInventoryCountValidator() => RuleFor(x => x.Comment).MaximumLength(1000);
}

public sealed class UpdateInventoryCountValidator : AbstractValidator<UpdateInventoryCountCommand>
{
    public UpdateInventoryCountValidator()
    {
        RuleFor(x => x.Lines).NotNull();
        RuleFor(x => x.Lines).Must(l => l.Select(x => x.IngredientId).Distinct().Count() == l.Count)
            .When(x => x.Lines is not null).WithMessage("Duplicate ingredient lines.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.IngredientId).NotEmpty();
            line.RuleFor(l => l.CountedQty).GreaterThanOrEqualTo(0).PrecisionScale(18, 3, true);
        });
    }
}
