using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.Common;

/// <summary>
/// Table status driven by orders: a dine-in order makes its table <c>occupied</c>; when the last active order of a
/// table is paid/cancelled/moved away the table becomes <c>available</c>. Queues <c>TableUpdated</c>.
/// </summary>
[ScopedService]
public sealed class TableOccupancy(IApplicationDbContext db, ITenantContext tenant, IClock clock, IRealtimeNotifier realtime)
{
    /// <summary>Tracked active table of the current branch that can take orders, or an error.</summary>
    public async Task<Result<DiningTable>> GetUsableTableAsync(Guid tableId, CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == tableId && t.BranchId == branchId, ct);
        if (table is null || table.IsArchived)
        {
            return OrderErrors.TableNotFound;
        }

        return !table.IsActive || table.Status == TableStatus.Unavailable ? OrderErrors.TableUnavailable : table;
    }

    public void Occupy(DiningTable table)
    {
        table.Status = TableStatus.Occupied;
        Notify(table);
    }

    /// <summary>Frees the table unless another active order (other than <paramref name="releasingOrderId"/>) is on it.</summary>
    public async Task ReleaseIfFreeAsync(Guid? tableId, Guid releasingOrderId, CancellationToken ct)
    {
        if (tableId is not { } id)
        {
            return;
        }

        var busy = await db.Orders.AnyAsync(
            o => o.TableId == id && o.Id != releasingOrderId && !OrderReadService.ClosedStatuses.Contains(o.Status), ct);
        if (busy)
        {
            return;
        }

        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (table is { Status: TableStatus.Occupied })
        {
            table.Status = TableStatus.Available;
            Notify(table);
        }
    }

    public void Notify(DiningTable table) =>
        realtime.ToBranch(table.BranchId, RealtimeEvents.TableUpdated, new
        {
            tableId = table.Id,
            status = table.Status,
            branchId = table.BranchId,
            occurredAt = clock.UtcNow,
        });
}
