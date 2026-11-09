using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Floor;

namespace Restaurant.Application.Features.Floor.Tables;

/// <summary>Non-archived tables of the current branch (floor plan / waiter screen).</summary>
public sealed class ListTablesHandler(IApplicationDbContext db, ITenantContext tenant, TableReadService reader)
    : IHandler<ListTablesQuery, IReadOnlyList<TableDto>>
{
    public async Task<Result<IReadOnlyList<TableDto>>> HandleAsync(ListTablesQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var query = db.DiningTables.AsNoTracking().Where(t => t.BranchId == branchId && !t.IsArchived);
        if (request.AreaId is { } areaId)
        {
            query = query.Where(t => t.DiningAreaId == areaId);
        }

        if (request.Status is { } status)
        {
            query = query.Where(t => t.Status == status);
        }

        var tables = await query.ToListAsync(cancellationToken);
        var ordered = tables.OrderBy(t => t.Number.Length).ThenBy(t => t.Number, StringComparer.OrdinalIgnoreCase).ToList();
        return Result.Success(await reader.BuildAsync(branchId, ordered, cancellationToken));
    }
}

/// <summary>Create (Id null) or update a table. Number is unique per branch among non-archived tables.</summary>
public sealed class SaveTableHandler(IApplicationDbContext db, ITenantContext tenant, TableReadService reader, IAuditLogger audit)
    : IHandler<SaveTableCommand, TableDto>
{
    public async Task<Result<TableDto>> HandleAsync(SaveTableCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var area = await db.DiningAreas.FirstOrDefaultAsync(a => a.Id == request.AreaId && a.BranchId == branchId, cancellationToken);
        if (area is null)
        {
            return FloorErrors.AreaNotFound;
        }

        if (area.IsArchived)
        {
            return FloorErrors.AreaArchived;
        }

        DiningTable table;
        if (request.Id is { } id)
        {
            var existing = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == id && t.BranchId == branchId, cancellationToken);
            if (existing is null)
            {
                return FloorErrors.TableNotFound;
            }

            if (existing.IsArchived)
            {
                return FloorErrors.TableArchived;
            }

            table = existing;
        }
        else
        {
            table = new DiningTable { BranchId = branchId };
            db.DiningTables.Add(table);
        }

        var number = request.Number.Trim();
        var taken = await db.DiningTables.AnyAsync(
            t => t.BranchId == branchId && !t.IsArchived && t.Number == number && t.Id != table.Id, cancellationToken);
        if (taken)
        {
            return FloorErrors.TableNumberTaken;
        }

        table.Number = number;
        table.Capacity = request.Capacity;
        table.DiningAreaId = area.Id;
        table.PosX = request.PosX;
        table.PosY = request.PosY;
        table.IsActive = request.IsActive ?? table.IsActive;
        audit.Log(request.Id is null ? "table.created" : "table.updated", nameof(DiningTable), table.Id, request);
        await db.SaveChangesAsync(cancellationToken);
        return await reader.BuildAsync(table, cancellationToken);
    }
}

/// <summary>Archives a table (DELETE); refused while an order is active on it.</summary>
public sealed class ArchiveTableHandler(
    IApplicationDbContext db, ITenantContext tenant, TableReadService reader, IClock clock, IAuditLogger audit)
    : IHandler<ArchiveTableCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ArchiveTableCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == request.Id && t.BranchId == branchId, cancellationToken);
        if (table is null)
        {
            return FloorErrors.TableNotFound;
        }

        if (table.IsArchived)
        {
            return Unit.Value;
        }

        if (await reader.HasActiveOrderAsync(table, cancellationToken))
        {
            return FloorErrors.TableHasActiveOrder;
        }

        table.Archive(clock.UtcNow);
        audit.Log("table.archived", nameof(DiningTable), table.Id, new { table.Number });
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

/// <summary>Manual status (available/unavailable). Emits <c>TableUpdated</c> on change.</summary>
public sealed class SetTableStatusHandler(
    IApplicationDbContext db, ITenantContext tenant, TableReadService reader, IClock clock, IAuditLogger audit, IRealtimeNotifier realtime)
    : IHandler<SetTableStatusCommand, TableDto>
{
    public async Task<Result<TableDto>> HandleAsync(SetTableStatusCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == request.TableId && t.BranchId == branchId, cancellationToken);
        if (table is null)
        {
            return FloorErrors.TableNotFound;
        }

        var previous = table.Status;
        var hasActiveOrder = await reader.HasActiveOrderAsync(table, cancellationToken);
        if (table.SetManualStatus(request.Status, hasActiveOrder))
        {
            audit.Log("table.status_changed", nameof(DiningTable), table.Id, new { from = previous, to = table.Status });
            realtime.ToBranch(branchId, RealtimeEvents.TableUpdated, TableEvents.Payload(table, clock.UtcNow));
            await db.SaveChangesAsync(cancellationToken);
        }

        return await reader.BuildAsync(table, cancellationToken);
    }
}
