using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Application.Features.Kitchen.Common;

/// <summary>
/// Keeps kitchen tickets consistent with order-side changes: creates per-station tickets on send,
/// cancels ticket items/tickets on cancellation, closes tickets whose items were all served. Queues realtime events.
/// </summary>
[ScopedService]
public sealed class KitchenTicketSync(IApplicationDbContext db, IClock clock, IRealtimeNotifier realtime)
{
    /// <summary>
    /// Groups the sent items by station (item's station if it is an active station of the branch, else the default =
    /// first active station by SortOrder) and creates one ticket per station. Pass the items returned by
    /// <see cref="Order.SendItems"/>; no active station → 422 (the unit of work is not saved).
    /// </summary>
    public async Task<IReadOnlyList<KitchenTicket>> CreateTicketsAsync(Order order, IReadOnlyList<OrderItem> sentItems, string? tableLabel, CancellationToken ct)
    {
        var stations = await ActiveStationIdsAsync(order.BranchId, ct);
        if (stations.Count == 0)
        {
            throw new DomainException(KitchenErrors.NoActiveStation);
        }

        var number = (await db.KitchenTickets.Where(t => t.OrderId == order.Id).MaxAsync(t => (int?)t.Number, ct) ?? 0) + 1;
        var tickets = new List<KitchenTicket>();
        foreach (var group in sentItems.GroupBy(i => i.KitchenStationId is { } s && stations.Contains(s) ? s : stations[0]))
        {
            foreach (var item in group)
            {
                item.KitchenStationId = group.Key;
            }

            var ticket = KitchenTicket.Create(order.OrganizationId, order.BranchId, order.Id, group.Key, number, group.Select(i => i.Id));
            db.KitchenTickets.Add(ticket);
            tickets.Add(ticket);
            realtime.ToKitchen(order.BranchId, group.Key, RealtimeEvents.KitchenTicketCreated, new
            {
                ticketId = ticket.Id,
                orderId = order.Id,
                stationId = group.Key,
                tableLabel,
                createdAt = clock.UtcNow,
                branchId = order.BranchId,
                occurredAt = clock.UtcNow,
            });
        }

        return tickets;
    }

    /// <summary>Order items were cancelled: cancel their ticket items in open tickets.</summary>
    public async Task CancelOrderItemsAsync(Order order, IReadOnlyCollection<Guid> orderItemIds, CancellationToken ct)
    {
        foreach (var ticket in await OpenTicketsAsync(order.Id, ct))
        {
            var changed = orderItemIds.Select(id => ticket.CancelOrderItem(id, clock.UtcNow)).ToList().Any(c => c);
            if (changed)
            {
                Notify(ticket);
            }
        }
    }

    /// <summary>The order was cancelled: cancel all its open tickets.</summary>
    public async Task CancelOrderTicketsAsync(Order order, CancellationToken ct)
    {
        foreach (var ticket in await OpenTicketsAsync(order.Id, ct))
        {
            ticket.Cancel();
            Notify(ticket);
        }
    }

    /// <summary>Ready tickets whose active items are all served on the order side become <c>served</c>.</summary>
    public async Task CloseServedTicketsAsync(Order order, CancellationToken ct)
    {
        var served = order.Items.Where(i => i.Status == OrderItemStatus.Served).Select(i => i.Id).ToHashSet();
        foreach (var ticket in (await OpenTicketsAsync(order.Id, ct)).Where(t => t.Status == KitchenTicketStatus.Ready))
        {
            var active = ticket.Items.Where(i => i.Status != KitchenTicketItemStatus.Cancelled).ToList();
            if (active.Count > 0 && active.All(i => served.Contains(i.OrderItemId)))
            {
                ticket.MarkServed();
                Notify(ticket);
            }
        }
    }

    public void Notify(KitchenTicket ticket) =>
        realtime.ToKitchen(ticket.BranchId, ticket.KitchenStationId, RealtimeEvents.KitchenTicketUpdated, new
        {
            ticketId = ticket.Id,
            orderId = ticket.OrderId,
            stationId = ticket.KitchenStationId,
            status = ticket.Status,
            branchId = ticket.BranchId,
            occurredAt = clock.UtcNow,
        });

    private async Task<List<KitchenTicket>> OpenTicketsAsync(Guid orderId, CancellationToken ct) =>
        await db.KitchenTickets
            .Include(t => t.Items)
            .Where(t => t.OrderId == orderId
                        && (t.Status == KitchenTicketStatus.New || t.Status == KitchenTicketStatus.InProgress || t.Status == KitchenTicketStatus.Ready))
            .ToListAsync(ct);

    private Task<List<Guid>> ActiveStationIdsAsync(Guid branchId, CancellationToken ct) =>
        db.KitchenStations.AsNoTracking()
            .Where(s => s.BranchId == branchId && s.IsActive && !s.IsArchived)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => s.Id)
            .ToListAsync(ct);
}
