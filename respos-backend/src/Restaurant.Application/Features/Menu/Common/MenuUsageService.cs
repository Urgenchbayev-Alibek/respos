using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;

namespace Restaurant.Application.Features.Menu.Common;

/// <summary>
/// "Is this menu row referenced by history?" checks. Referenced rows (orders, recipes) are archived, never deleted
/// (BR-6.1); unreferenced child rows may be removed physically.
/// </summary>
[ScopedService]
public sealed class MenuUsageService(IApplicationDbContext db)
{
    public async Task<bool> IsVariantUsedAsync(Guid variantId, CancellationToken cancellationToken) =>
        await db.OrderItems.AnyAsync(i => i.VariantId == variantId, cancellationToken)
        || await db.Recipes.AnyAsync(r => r.VariantId == variantId, cancellationToken);

    public Task<bool> IsOptionUsedAsync(Guid optionId, CancellationToken cancellationToken) =>
        db.OrderItemModifiers.AnyAsync(m => m.ModifierOptionId == optionId, cancellationToken);

    public Task<bool> IsGroupUsedAsync(Guid groupId, CancellationToken cancellationToken) =>
        db.OrderItemModifiers.AnyAsync(
            m => db.ModifierOptions.Any(o => o.GroupId == groupId && o.Id == m.ModifierOptionId), cancellationToken);
}
