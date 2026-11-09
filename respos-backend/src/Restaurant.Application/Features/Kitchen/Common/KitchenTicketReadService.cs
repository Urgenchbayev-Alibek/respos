using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Entities.Kitchen;

namespace Restaurant.Application.Features.Kitchen.Common;

/// <summary>Builds KDS ticket DTOs (order number, table, waiter, item snapshots) for the current branch.</summary>
[ScopedService]
public sealed class KitchenTicketReadService(IApplicationDbContext db, ITenantContext tenant, UserNameLookup users)
{
    public IQueryable<KitchenTicket> BranchTickets()
    {
        var branchId = tenant.RequireBranchId();
        return db.KitchenTickets.AsNoTracking().Where(t => t.BranchId == branchId);
    }

    public async Task<KitchenTicketDto?> GetAsync(Guid ticketId, CancellationToken ct) =>
        (await MapAsync(await BranchTickets().Where(t => t.Id == ticketId).Include(t => t.Items).Include(t => t.KitchenStation).ToListAsync(ct), ct))
        .FirstOrDefault();

    /// <summary>Maps tickets preserving their order.</summary>
    public async Task<IReadOnlyList<KitchenTicketDto>> MapAsync(IReadOnlyList<KitchenTicket> tickets, CancellationToken ct)
    {
        if (tickets.Count == 0)
        {
            return [];
        }

        var orderIds = tickets.Select(t => t.OrderId).Distinct().ToList();
        var orders = await db.Orders.AsNoTracking()
            .Where(o => orderIds.Contains(o.Id))
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .AsSplitQuery()
            .ToDictionaryAsync(o => o.Id, ct);
        var tableIds = orders.Values.Where(o => o.TableId.HasValue).Select(o => o.TableId!.Value).Distinct().ToList();
        var tables = await db.DiningTables.AsNoTracking()
            .Where(t => tableIds.Contains(t.Id))
            .Select(t => new { t.Id, t.Number })
            .ToDictionaryAsync(t => t.Id, t => t.Number, ct);
        var names = await users.GetAsync(orders.Values.Select(o => (Guid?)o.WaiterId), ct);

        var result = new List<KitchenTicketDto>(tickets.Count);
        foreach (var ticket in tickets)
        {
            if (!orders.TryGetValue(ticket.OrderId, out var order))
            {
                continue;
            }

            var orderItems = order.Items.ToDictionary(i => i.Id);
            var items = ticket.Items
                .Where(ti => orderItems.ContainsKey(ti.OrderItemId))
                .Select(ti =>
                {
                    var oi = orderItems[ti.OrderItemId];
                    return new KitchenTicketItemDto(ti.Id, oi.Id, oi.NameSnapshot, oi.VariantNameSnapshot, oi.Quantity,
                        oi.Modifiers.Select(m => m.NameSnapshot).ToList(), oi.Comment, ti.Status);
                })
                .OrderBy(i => i.Name)
                .ToList();
            result.Add(new KitchenTicketDto(
                ticket.Id, ticket.Number, order.Id, order.Number,
                order.TableId is { } tableId ? tables.GetValueOrDefault(tableId) : null,
                names.GetValueOrDefault(order.WaiterId),
                ticket.KitchenStationId, ticket.KitchenStation?.Name ?? string.Empty,
                ticket.Status, ticket.CreatedAt, ticket.StartedAt, ticket.ReadyAt, items));
        }

        return result;
    }
}
