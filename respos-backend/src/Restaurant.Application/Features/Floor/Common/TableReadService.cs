using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Floor.Common;

/// <summary>Builds <see cref="TableDto"/> with the active order and today's next confirmed reservation.</summary>
[ScopedService]
public sealed class TableReadService(IApplicationDbContext db, IClock clock, BranchTimeService branchTime)
{
    /// <summary>Orders that keep a table busy (not paid, not cancelled).</summary>
    public IQueryable<Domain.Entities.Orders.Order> ActiveOrders(Guid branchId) =>
        db.Orders.Where(o => o.BranchId == branchId && o.Status != OrderStatus.Paid && o.Status != OrderStatus.Cancelled);

    public Task<bool> HasActiveOrderAsync(DiningTable table, CancellationToken cancellationToken) =>
        ActiveOrders(table.BranchId).AnyAsync(o => o.TableId == table.Id, cancellationToken);

    public async Task<IReadOnlyList<TableDto>> BuildAsync(Guid branchId, IReadOnlyList<DiningTable> tables, CancellationToken cancellationToken)
    {
        if (tables.Count == 0)
        {
            return [];
        }

        var ids = tables.Select(t => t.Id).ToList();
        var areaIds = tables.Select(t => t.DiningAreaId).Distinct().ToList();
        var areas = await db.DiningAreas.AsNoTracking().Where(a => areaIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.Name, cancellationToken);

        var orders = await ActiveOrders(branchId).AsNoTracking()
            .Where(o => o.TableId != null && ids.Contains(o.TableId.Value))
            .OrderByDescending(o => o.OpenedAt)
            .Select(o => new { TableId = o.TableId!.Value, o.Id, o.Total })
            .ToListAsync(cancellationToken);
        var orderByTable = orders.GroupBy(o => o.TableId).ToDictionary(g => g.Key, g => g.First());

        var now = clock.UtcNow;
        var today = DateOnly.FromDateTime(await branchTime.LocalNowAsync(branchId, cancellationToken));
        var (_, endOfDay) = await branchTime.DayRangeUtcAsync(branchId, today, cancellationToken);
        var reservations = await db.TableReservations.AsNoTracking()
            .Where(r => r.BranchId == branchId && r.TableId != null && ids.Contains(r.TableId.Value)
                        && r.Status == ReservationStatus.Confirmed && r.EndsAt > now && r.StartsAt < endOfDay)
            .OrderBy(r => r.StartsAt)
            .Select(r => new { TableId = r.TableId!.Value, r.Id, r.StartsAt, r.GuestName })
            .ToListAsync(cancellationToken);
        var nextByTable = reservations.GroupBy(r => r.TableId).ToDictionary(g => g.Key, g => g.First());

        return tables.Select(t =>
        {
            orderByTable.TryGetValue(t.Id, out var order);
            nextByTable.TryGetValue(t.Id, out var next);
            return new TableDto(
                t.Id, t.Number, t.Capacity, t.DiningAreaId, areas.GetValueOrDefault(t.DiningAreaId, string.Empty),
                t.Status, t.IsActive, t.PosX, t.PosY, order?.Id, order?.Total,
                next is null ? null : new NextReservationDto(next.Id, next.StartsAt, next.GuestName));
        }).ToList();
    }

    public async Task<TableDto> BuildAsync(DiningTable table, CancellationToken cancellationToken) =>
        (await BuildAsync(table.BranchId, [table], cancellationToken))[0];
}
