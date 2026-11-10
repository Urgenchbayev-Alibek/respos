using FluentValidation;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Inventory.Ingredients;

/// <summary><c>GET /ingredients?categoryId=&amp;search=&amp;lowStock=&amp;includeArchived=&amp;page=&amp;pageSize=&amp;sort=</c>.</summary>
public sealed record ListIngredientsQuery : PageQuery
{
    public Guid? CategoryId { get; init; }
    public bool? LowStock { get; init; }
    public bool IncludeArchived { get; init; }
}

/// <summary>Create (Id null) or update. <c>MinQuantity</c> applies to the current branch; <c>DefaultSupplierId</c> groups purchase suggestions.</summary>
public sealed record SaveIngredientCommand(
    string Name, string? Sku, Guid? CategoryId, Guid BaseUnitId, decimal CostPrice, decimal? MinQuantity, Guid? DefaultSupplierId = null)
{
    public Guid? Id { get; init; }
}

public sealed record ArchiveIngredientCommand(Guid Id);

public sealed record SetMinQuantityCommand(decimal MinQuantity)
{
    public Guid IngredientId { get; init; }
}

public sealed class SaveIngredientValidator : AbstractValidator<SaveIngredientCommand>
{
    public SaveIngredientValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Sku).MaximumLength(64);
        RuleFor(x => x.BaseUnitId).NotEmpty();
        RuleFor(x => x.CostPrice).GreaterThanOrEqualTo(0).PrecisionScale(18, 2, true);
        RuleFor(x => x.MinQuantity).GreaterThanOrEqualTo(0).PrecisionScale(18, 3, true);
    }
}

public sealed class SetMinQuantityValidator : AbstractValidator<SetMinQuantityCommand>
{
    public SetMinQuantityValidator() => RuleFor(x => x.MinQuantity).GreaterThanOrEqualTo(0).PrecisionScale(18, 3, true);
}
