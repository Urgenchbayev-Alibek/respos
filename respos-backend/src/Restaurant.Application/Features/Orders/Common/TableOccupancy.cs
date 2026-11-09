using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.Common;

/// <summary>
/// Table status driven by orders: a dine-in order makes its table <c>occupied</c>; when the last active order of a
/// table is paid/cancelled/moved away the table becomes <c>available</c>. Queues <c>TableUpdated</c> on a change.
/// Status rules live in the Floor domain (<see cref="DiningTable.Occupy"/>, <see cref="DiningTable.ReleaseIfIdle"/>);
/// "busy" is <see cref="TableReadService.ActiveOrders"/> — shared with reservations, no duplicated rules.
/// </summary>
[ScopedService]
public sealed class TableOccupancy(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, IRealtimeNotifier realtime, TableReadService tableReads)
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
        if (table.Occupy())
        {
            Notify(table);
        }
    }

    /// <summary>Frees the table unless another active order (other than <paramref name="releasingOrderId"/>) is on it.</summary>
    public async Task ReleaseIfFreeAsync(Guid? tableId, Guid releasingOrderId, CancellationToken ct)
    {
        if (tableId is not { } id)
        {
            return;
        }

        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (table is null)
        {
            return;
        }

        // the releasing order's new status is not saved yet → exclude it explicitly
        var busy = await tableReads.ActiveOrders(table.BranchId).AnyAsync(o => o.TableId == id && o.Id != releasingOrderId, ct);
        if (table.ReleaseIfIdle(busy))
        {
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
