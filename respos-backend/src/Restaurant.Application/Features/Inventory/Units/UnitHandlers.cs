using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;

namespace Restaurant.Application.Features.Inventory.Units;

/// <summary><c>GET /units</c> — plain array, org-scoped.</summary>
public sealed class ListUnitsHandler(IApplicationDbContext db, ITenantContext tenant) : IHandler<ListUnitsQuery, IReadOnlyList<UnitDto>>
{
    public async Task<Result<IReadOnlyList<UnitDto>>> HandleAsync(ListUnitsQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        return await db.Units.AsNoTracking().OrderBy(u => u.Kind).ThenBy(u => u.Code)
            .Select(u => new UnitDto(u.Id, u.Code, u.Name, u.Kind))
            .ToListAsync(cancellationToken);
    }
}

public sealed class ListUnitConversionsHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListUnitConversionsQuery, IReadOnlyList<UnitConversionDto>>
{
    public async Task<Result<IReadOnlyList<UnitConversionDto>>> HandleAsync(ListUnitConversionsQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        return await db.UnitConversions.AsNoTracking().OrderBy(c => c.FromUnit!.Code).ThenBy(c => c.ToUnit!.Code)
            .Select(c => new UnitConversionDto(c.Id, c.FromUnitId, c.FromUnit!.Code, c.ToUnitId, c.ToUnit!.Code, c.Factor))
            .ToListAsync(cancellationToken);
    }
}

public sealed class CreateUnitHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<CreateUnitCommand, UnitDto>
{
    public async Task<Result<UnitDto>> HandleAsync(CreateUnitCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var code = request.Code.Trim().ToLowerInvariant();
        if (await db.Units.AnyAsync(u => u.Code == code, cancellationToken))
        {
            return InventoryErrors.UnitCodeTaken;
        }

        var unit = new UnitOfMeasure { OrganizationId = orgId, Code = code, Name = request.Name.Trim(), Kind = request.Kind };
        db.Units.Add(unit);
        audit.Log("unit.created", nameof(UnitOfMeasure), unit.Id, new { unit.Code, unit.Name, unit.Kind });
        await db.SaveChangesAsync(cancellationToken);
        return new UnitDto(unit.Id, unit.Code, unit.Name, unit.Kind);
    }
}

/// <summary><c>POST /unit-conversions</c>: quantityInTo = quantityInFrom × factor; the inverse is derived automatically.</summary>
public sealed class CreateUnitConversionHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<CreateUnitConversionCommand, UnitConversionDto>
{
    public async Task<Result<UnitConversionDto>> HandleAsync(CreateUnitConversionCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var units = await db.Units.Where(u => u.Id == request.FromUnitId || u.Id == request.ToUnitId)
            .ToDictionaryAsync(u => u.Id, cancellationToken);
        if (!units.TryGetValue(request.FromUnitId, out var from) || !units.TryGetValue(request.ToUnitId, out var to))
        {
            return InventoryErrors.UnitNotFound;
        }

        if (await db.UnitConversions.AnyAsync(
                c => (c.FromUnitId == from.Id && c.ToUnitId == to.Id) || (c.FromUnitId == to.Id && c.ToUnitId == from.Id),
                cancellationToken))
        {
            return InventoryErrors.ConversionExists;
        }

        var conversion = new UnitConversion { OrganizationId = orgId, FromUnitId = from.Id, ToUnitId = to.Id, Factor = request.Factor };
        db.UnitConversions.Add(conversion);
        audit.Log("unit_conversion.created", nameof(UnitConversion), conversion.Id, new { from = from.Code, to = to.Code, request.Factor });
        await db.SaveChangesAsync(cancellationToken);
        return new UnitConversionDto(conversion.Id, from.Id, from.Code, to.Id, to.Code, conversion.Factor);
    }
}
