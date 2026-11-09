using FluentValidation;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Floor.DiningAreas;

public sealed record ListDiningAreasQuery;

public sealed record SaveDiningAreaCommand(string Name, int? SortOrder, bool? IsActive)
{
    /// <summary>Null = create.</summary>
    public Guid? Id { get; init; }
}

public sealed record ArchiveDiningAreaCommand(Guid Id);

public sealed class SaveDiningAreaValidator : AbstractValidator<SaveDiningAreaCommand>
{
    public SaveDiningAreaValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}
