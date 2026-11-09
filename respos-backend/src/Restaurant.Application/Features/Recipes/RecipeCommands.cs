using FluentValidation;

namespace Restaurant.Application.Features.Recipes;

/// <summary><c>GET /recipes?menuItemId=</c> — active versions.</summary>
public sealed record ListRecipesQuery(Guid? MenuItemId);

/// <summary><c>GET /recipes/history?menuItemId=</c> — all versions (newest first).</summary>
public sealed record RecipeHistoryQuery(Guid MenuItemId);

public sealed record GetRecipeQuery(Guid Id);

public sealed record RecipeLine(Guid IngredientId, decimal Quantity, Guid UnitId);

/// <summary><c>POST /recipes</c> — always creates a new version and deactivates the previous one.</summary>
public sealed record SaveRecipeCommand(Guid MenuItemId, Guid? VariantId, IReadOnlyList<RecipeLine> Ingredients);

public sealed class SaveRecipeValidator : AbstractValidator<SaveRecipeCommand>
{
    public SaveRecipeValidator()
    {
        RuleFor(x => x.MenuItemId).NotEmpty();
        RuleFor(x => x.Ingredients).NotEmpty();
        RuleFor(x => x.Ingredients).Must(l => l.Select(x => x.IngredientId).Distinct().Count() == l.Count)
            .When(x => x.Ingredients is not null).WithMessage("Duplicate ingredients.");
        RuleForEach(x => x.Ingredients).ChildRules(line =>
        {
            line.RuleFor(l => l.IngredientId).NotEmpty();
            line.RuleFor(l => l.UnitId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).PrecisionScale(18, 3, true);
        });
    }
}

public sealed class RecipeHistoryValidator : AbstractValidator<RecipeHistoryQuery>
{
    public RecipeHistoryValidator() => RuleFor(x => x.MenuItemId).NotEmpty();
}
