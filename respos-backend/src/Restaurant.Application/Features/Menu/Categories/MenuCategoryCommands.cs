using FluentValidation;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Menu.Categories;

public sealed record ListMenuCategoriesQuery
{
    public bool IncludeArchived { get; init; }
}

public sealed record SaveMenuCategoryCommand(string Name, string? NameUz, int? SortOrder, bool? IsActive)
{
    /// <summary>Null = create.</summary>
    public Guid? Id { get; init; }
}

public sealed record ArchiveMenuCategoryCommand(Guid Id);

/// <summary><c>PUT /menu/categories/reorder { ids }</c>: SortOrder = position in <see cref="Ids"/>.</summary>
public sealed record ReorderMenuCategoriesCommand(IReadOnlyList<Guid> Ids);

public sealed class SaveMenuCategoryValidator : AbstractValidator<SaveMenuCategoryCommand>
{
    public SaveMenuCategoryValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.NameUz).MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}

public sealed class ReorderMenuCategoriesValidator : AbstractValidator<ReorderMenuCategoriesCommand>
{
    public const int MaxIds = 500;

    public ReorderMenuCategoriesValidator()
    {
        RuleFor(x => x.Ids).Cascade(CascadeMode.Stop).NotNull().NotEmpty()
            .Must(ids => ids.Count <= MaxIds).WithMessage($"At most {MaxIds} categories.")
            .Must(ids => ids.Distinct().Count() == ids.Count).WithMessage("Ids must be unique.");
    }
}
