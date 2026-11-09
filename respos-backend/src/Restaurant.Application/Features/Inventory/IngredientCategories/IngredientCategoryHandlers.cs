using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;

namespace Restaurant.Application.Features.Inventory.IngredientCategories;

public sealed record ListIngredientCategoriesQuery(bool IncludeArchived = false);

public sealed record SaveIngredientCategoryCommand(string Name)
{
    public Guid? Id { get; init; }
}

public sealed record DeleteIngredientCategoryCommand(Guid Id);

public sealed class SaveIngredientCategoryValidator : AbstractValidator<SaveIngredientCategoryCommand>
{
    public SaveIngredientCategoryValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
}

public sealed class ListIngredientCategoriesHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListIngredientCategoriesQuery, IReadOnlyList<IngredientCategoryDto>>
{
    public async Task<Result<IReadOnlyList<IngredientCategoryDto>>> HandleAsync(
        ListIngredientCategoriesQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        return await db.IngredientCategories.AsNoTracking()
            .Where(c => request.IncludeArchived || !c.IsArchived)
            .OrderBy(c => c.Name)
            .Select(c => new IngredientCategoryDto(c.Id, c.Name, c.IsArchived))
            .ToListAsync(cancellationToken);
    }
}

/// <summary>Create (Id null) or rename a category.</summary>
public sealed class SaveIngredientCategoryHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<SaveIngredientCategoryCommand, IngredientCategoryDto>
{
    public async Task<Result<IngredientCategoryDto>> HandleAsync(SaveIngredientCategoryCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        IngredientCategory? category;
        if (request.Id is { } id)
        {
            category = await db.IngredientCategories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
            if (category is null)
            {
                return InventoryErrors.CategoryNotFound;
            }
        }
        else
        {
            category = new IngredientCategory { OrganizationId = orgId };
            db.IngredientCategories.Add(category);
        }

        category.Name = request.Name.Trim();
        audit.Log(request.Id is null ? "ingredient_category.created" : "ingredient_category.updated",
            nameof(IngredientCategory), category.Id, new { category.Name });
        await db.SaveChangesAsync(cancellationToken);
        return new IngredientCategoryDto(category.Id, category.Name, category.IsArchived);
    }
}

/// <summary>Deletes an unused category; a category referenced by ingredients is archived instead (BR-16.2).</summary>
public sealed class DeleteIngredientCategoryHandler(IApplicationDbContext db, IClock clock, IAuditLogger audit)
    : IHandler<DeleteIngredientCategoryCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(DeleteIngredientCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await db.IngredientCategories.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
        if (category is null)
        {
            return InventoryErrors.CategoryNotFound;
        }

        if (await db.Ingredients.AnyAsync(i => i.CategoryId == category.Id, cancellationToken))
        {
            category.Archive(clock.UtcNow);
            audit.Log("ingredient_category.archived", nameof(IngredientCategory), category.Id);
        }
        else
        {
            db.IngredientCategories.Remove(category);
            audit.Log("ingredient_category.deleted", nameof(IngredientCategory), category.Id);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
