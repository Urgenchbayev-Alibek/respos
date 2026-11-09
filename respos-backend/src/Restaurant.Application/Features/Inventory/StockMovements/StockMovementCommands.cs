using Restaurant.Application.Common.Extensions;
using FluentValidation;
using Restaurant.Application.Common.Models;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.StockMovements;

/// <summary>
/// <c>POST /stock/movements</c>. <c>quantity</c> is in <c>unitId</c> (default: ingredient base unit):
/// write_off and receipt take a positive amount (write_off is applied as −quantity); adjustment is signed.
/// </summary>
public sealed record CreateStockMovementCommand(
    Guid IngredientId, StockMovementType Type, decimal Quantity, Guid? UnitId, decimal? UnitCost, string Reason);

/// <summary><c>GET /stock/movements?ingredientId=&amp;type=&amp;from=&amp;to=&amp;sourceType=&amp;page=&amp;pageSize=</c>.</summary>
public sealed record ListStockMovementsQuery : PageQuery
{
    public Guid? IngredientId { get; init; }
    public string? Type { get; init; }
    public string? SourceType { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}

public sealed class CreateStockMovementValidator : AbstractValidator<CreateStockMovementCommand>
{
    public CreateStockMovementValidator()
    {
        RuleFor(x => x.IngredientId).NotEmpty();
        RuleFor(x => x.Type)
            .Must(t => t is StockMovementType.WriteOff or StockMovementType.Adjustment or StockMovementType.Receipt)
            .WithMessage("Type must be write_off, adjustment or receipt.");
        RuleFor(x => x.Quantity).NotEqual(0).PrecisionScale(18, 3, true);
        RuleFor(x => x.Quantity).GreaterThan(0).When(x => x.Type != StockMovementType.Adjustment);
        RuleFor(x => x.UnitCost).GreaterThanOrEqualTo(0).PrecisionScale(18, 2, true);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}

public sealed class ListStockMovementsValidator : AbstractValidator<ListStockMovementsQuery>
{
    public ListStockMovementsValidator()
    {
        RuleFor(x => x.Type).Must(SnakeCaseEnum.IsValidOrEmpty<StockMovementType>).WithMessage("Unknown movement type.");
        RuleFor(x => x.SourceType).Must(SnakeCaseEnum.IsValidOrEmpty<StockMovementSource>).WithMessage("Unknown source type.");
    }
}
