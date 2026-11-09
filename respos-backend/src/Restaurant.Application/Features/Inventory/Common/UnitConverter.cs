using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;

namespace Restaurant.Application.Features.Inventory.Common;

/// <summary>
/// Converts quantities between units of one organization using <see cref="UnitConversion"/>
/// (direct factor, or 1/factor of the inverse row). Conversions are loaded once per scope.
/// </summary>
[ScopedService]
public sealed class UnitConverter(IApplicationDbContext db)
{
    public const int QuantityDecimals = 3;

    private readonly Dictionary<Guid, List<UnitConversion>> _cache = [];

    public async Task<decimal?> TryGetFactorAsync(Guid organizationId, Guid fromUnitId, Guid toUnitId, CancellationToken cancellationToken)
    {
        if (fromUnitId == toUnitId)
        {
            return 1m;
        }

        var conversions = await LoadAsync(organizationId, cancellationToken);
        var direct = conversions.FirstOrDefault(c => c.FromUnitId == fromUnitId && c.ToUnitId == toUnitId);
        if (direct is { Factor: > 0 })
        {
            return direct.Factor;
        }

        var inverse = conversions.FirstOrDefault(c => c.FromUnitId == toUnitId && c.ToUnitId == fromUnitId);
        return inverse is { Factor: > 0 } ? 1m / inverse.Factor : null;
    }

    /// <summary><paramref name="quantity"/> in <paramref name="fromUnitId"/> → base unit (3 decimals), or 422 <c>unit.conversion_missing</c>.</summary>
    public async Task<Result<decimal>> ToBaseAsync(
        Guid organizationId, decimal quantity, Guid fromUnitId, Guid baseUnitId, CancellationToken cancellationToken)
    {
        var factor = await TryGetFactorAsync(organizationId, fromUnitId, baseUnitId, cancellationToken);
        return factor is { } f ? RoundQuantity(quantity * f) : InventoryErrors.ConversionMissing;
    }

    public static decimal RoundQuantity(decimal quantity) =>
        Math.Round(quantity, QuantityDecimals, MidpointRounding.AwayFromZero);

    private async Task<List<UnitConversion>> LoadAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        if (!_cache.TryGetValue(organizationId, out var list))
        {
            list = await db.UnitConversions.IgnoreQueryFilters().AsNoTracking()
                .Where(c => c.OrganizationId == organizationId)
                .ToListAsync(cancellationToken);
            _cache[organizationId] = list;
        }

        return list;
    }
}
