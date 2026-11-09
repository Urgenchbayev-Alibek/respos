using FluentValidation;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.ModifierGroups;

public sealed record ListModifierGroupsQuery;

public sealed record ModifierOptionInput(Guid? Id, string Name, decimal PriceDelta);

public sealed record SaveModifierGroupCommand(
    string Name, int MinSelect, int MaxSelect, bool IsRequired, IReadOnlyList<ModifierOptionInput> Options)
{
    /// <summary>Null = create.</summary>
    public Guid? Id { get; init; }
}

public sealed record DeleteModifierGroupCommand(Guid Id);

/// <summary>BR-6.4: 0 ≤ minSelect ≤ maxSelect, maxSelect ≥ 1, isRequired ⇒ minSelect ≥ 1, minSelect ≤ options.</summary>
public sealed class SaveModifierGroupValidator : AbstractValidator<SaveModifierGroupCommand>
{
    public const int MaxOptions = 100;

    public SaveModifierGroupValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.MinSelect).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxSelect).GreaterThanOrEqualTo(1).GreaterThanOrEqualTo(x => x.MinSelect)
            .WithMessage("maxSelect must be at least 1 and not less than minSelect.");
        RuleFor(x => x.MinSelect).GreaterThanOrEqualTo(1).When(x => x.IsRequired)
            .WithMessage("A required group needs minSelect of at least 1.");
        RuleFor(x => x.Options).Cascade(CascadeMode.Stop).NotNull().NotEmpty()
            .Must(o => o.Count <= MaxOptions).WithMessage($"At most {MaxOptions} options.")
            .Must((cmd, o) => ModifierRules.IsValidDefinition(cmd.MinSelect, cmd.MaxSelect, cmd.IsRequired, o.Count))
            .WithMessage("minSelect cannot exceed the number of options.")
            .Must(o => o.Where(x => x.Id != null).Select(x => x.Id).Distinct().Count() == o.Count(x => x.Id != null))
            .WithMessage("Option ids must be unique.");
        RuleForEach(x => x.Options).ChildRules(option =>
        {
            option.RuleFor(o => o.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
            option.RuleFor(o => o.PriceDelta).ValidMoney();
        });
    }
}
