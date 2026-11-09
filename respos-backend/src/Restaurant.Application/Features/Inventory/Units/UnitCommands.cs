using FluentValidation;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.Units;

public sealed record ListUnitsQuery;

public sealed record ListUnitConversionsQuery;

public sealed record CreateUnitCommand(string Code, string Name, UnitKind Kind);

public sealed record CreateUnitConversionCommand(Guid FromUnitId, Guid ToUnitId, decimal Factor);

public sealed class CreateUnitValidator : AbstractValidator<CreateUnitCommand>
{
    public CreateUnitValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(16);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Kind).IsInEnum();
    }
}

public sealed class CreateUnitConversionValidator : AbstractValidator<CreateUnitConversionCommand>
{
    public CreateUnitConversionValidator()
    {
        RuleFor(x => x.FromUnitId).NotEmpty();
        RuleFor(x => x.ToUnitId).NotEmpty().NotEqual(x => x.FromUnitId);
        RuleFor(x => x.Factor).GreaterThan(0).LessThan(1_000_000_000_000m);
    }
}
