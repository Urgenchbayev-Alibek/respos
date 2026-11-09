using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Kitchen.Common;

/// <summary>
/// Applies a KDS change to a ticket and mirrors it on the order items (DECISIONS_v1_1 §3), then commits and queues
/// <c>KitchenTicketUpdated</c>, <c>OrderItemReady</c> (per ready item) and <c>OrderUpdated</c>.
/// Each mirror method returns the number of order items it changed.
/// </summary>
[ScopedService]
public sealed class KitchenOrderSync(
    IApplicationDbContext db,
    ITenantContext tenant,
    IClock clock,
    IRealtimeNotifier realtime,
    OrderWriter writer,
    KitchenTicketSync tickets,
    KitchenTicketReadService reader)
{
    public async Task<Result<KitchenTicketDto>> ApplyAsync(KitchenTicket ticket, Func<Order, DateTime, int> change, CancellationToken ct)
    {
        var order = await writer.LoadAsync(ticket.OrderId, ct);
        if (order is null)
        {
            return KitchenErrors.TicketNotFound;
        }

        change(order, clock.UtcNow);
        tickets.Notify(ticket);
        writer.NotifyOrderUpdated(order);
        await db.SaveChangesAsync(ct);
        var dto = await reader.GetAsync(ticket.Id, ct);
        return dto is null ? KitchenErrors.TicketNotFound : dto;
    }

    public int StartItems(Order order, IReadOnlyList<KitchenTicketItem> items, DateTime now)
    {
        var changed = 0;
        foreach (var item in items.Where(i => order.GetItem(i.OrderItemId).Status == OrderItemStatus.Sent))
        {
            order.StartItemPreparing(item.OrderItemId, tenant.UserId, now);
            changed++;
        }

        return changed;
    }

    public int ReadyItems(Order order, IReadOnlyList<KitchenTicketItem> items, DateTime now)
    {
        var changed = 0;
        foreach (var item in items)
        {
            var orderItem = order.GetItem(item.OrderItemId);
            if (orderItem.Status is not (OrderItemStatus.Sent or OrderItemStatus.Preparing))
            {
                continue;
            }

            order.MarkItemReady(orderItem.Id, tenant.UserId, now);
            realtime.ToBranch(order.BranchId, RealtimeEvents.OrderItemReady, new
            {
                orderId = order.Id,
                orderItemId = orderItem.Id,
                tableId = order.TableId,
                itemName = orderItem.NameSnapshot,
                branchId = order.BranchId,
                occurredAt = now,
            });
            changed++;
        }

        return changed;
    }

    /// <summary>Ticket handed out: ticket <c>served</c>, its ready order items → <c>served</c>.</summary>
    public int ServeTicket(Order order, KitchenTicket ticket, DateTime now)
    {
        ticket.MarkServed();
        var changed = 0;
        foreach (var item in ticket.Items.Where(i => i.Status == KitchenTicketItemStatus.Ready))
        {
            if (order.GetItem(item.OrderItemId).Status == OrderItemStatus.Ready)
            {
                order.ServeItem(item.OrderItemId, tenant.UserId, now);
                changed++;
            }
        }

        return changed;
    }

    public int RecallItems(Order order, IReadOnlyList<KitchenTicketItem> items, DateTime now)
    {
        foreach (var item in items)
        {
            order.RecallItem(item.OrderItemId, tenant.UserId, now);
        }

        return items.Count;
    }
}
