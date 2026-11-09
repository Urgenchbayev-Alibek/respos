using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Floor;

namespace Restaurant.Application.Features.Floor.DiningAreas;

/// <summary>Non-archived areas of the current branch with their non-archived table counts.</summary>
public sealed class ListDiningAreasHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListDiningAreasQuery, IReadOnlyList<DiningAreaDto>>
{
    public async Task<Result<IReadOnlyList<DiningAreaDto>>> HandleAsync(ListDiningAreasQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        return await db.DiningAreas.AsNoTracking()
            .Where(a => a.BranchId == branchId && !a.IsArchived)
            .OrderBy(a => a.SortOrder).ThenBy(a => a.Name)
            .Select(a => new DiningAreaDto(a.Id, a.Name, a.SortOrder, a.IsActive, a.Tables.Count(t => !t.IsArchived)))
            .ToListAsync(cancellationToken);
    }
}

/// <summary>Create (Id null) or update a dining area of the current branch.</summary>
public sealed class SaveDiningAreaHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<SaveDiningAreaCommand, DiningAreaDto>
{
    public async Task<Result<DiningAreaDto>> HandleAsync(SaveDiningAreaCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        DiningArea area;
        if (request.Id is { } id)
        {
            var existing = await db.DiningAreas.FirstOrDefaultAsync(a => a.Id == id && a.BranchId == branchId, cancellationToken);
            if (existing is null)
            {
                return FloorErrors.AreaNotFound;
            }

            if (existing.IsArchived)
            {
                return FloorErrors.AreaArchived;
            }

            area = existing;
        }
        else
        {
            var nextSort = await db.DiningAreas.Where(a => a.BranchId == branchId)
                .Select(a => (int?)a.SortOrder).MaxAsync(cancellationToken) ?? -1;
            area = new DiningArea { BranchId = branchId, SortOrder = nextSort + 1 };
            db.DiningAreas.Add(area);
        }

        area.Name = request.Name.Trim();
        area.SortOrder = request.SortOrder ?? area.SortOrder;
        area.IsActive = request.IsActive ?? area.IsActive;
        audit.Log(request.Id is null ? "dining_area.created" : "dining_area.updated", nameof(DiningArea), area.Id, request);
        await db.SaveChangesAsync(cancellationToken);

        var tableCount = await db.DiningTables.CountAsync(t => t.DiningAreaId == area.Id && !t.IsArchived, cancellationToken);
        return new DiningAreaDto(area.Id, area.Name, area.SortOrder, area.IsActive, tableCount);
    }
}

/// <summary>Archives an area (DELETE). Areas with non-archived tables cannot be archived (409).</summary>
public sealed class ArchiveDiningAreaHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit)
    : IHandler<ArchiveDiningAreaCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ArchiveDiningAreaCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var area = await db.DiningAreas.FirstOrDefaultAsync(a => a.Id == request.Id && a.BranchId == branchId, cancellationToken);
        if (area is null)
        {
            return FloorErrors.AreaNotFound;
        }

        if (area.IsArchived)
        {
            return Unit.Value;
        }

        if (await db.DiningTables.AnyAsync(t => t.DiningAreaId == area.Id && !t.IsArchived, cancellationToken))
        {
            return FloorErrors.AreaHasTables;
        }

        area.Archive(clock.UtcNow);
        audit.Log("dining_area.archived", nameof(DiningArea), area.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
