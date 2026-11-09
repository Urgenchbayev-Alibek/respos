using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Kitchen;

/// <summary>
/// Ticket lifecycle (DECISIONS_v1_1 §3): ticket <c>new → in_progress → ready → served</c>, <c>cancelled</c>;
/// recall <c>ready → in_progress</c>. Ticket items: <c>new → preparing → ready</c>, <c>cancelled</c>.
/// Methods return the ticket items whose status changed so the caller can sync the order items.
/// </summary>
public partial class KitchenTicket
{
    public bool IsOpen => Status is KitchenTicketStatus.New or KitchenTicketStatus.InProgress or KitchenTicketStatus.Ready;

    private IEnumerable<KitchenTicketItem> ActiveItems => Items.Where(i => i.Status != KitchenTicketItemStatus.Cancelled);

    public static KitchenTicket Create(Guid organizationId, Guid branchId, Guid orderId, Guid stationId, int number, IEnumerable<Guid> orderItemIds)
    {
        var ticket = new KitchenTicket
        {
            OrganizationId = organizationId,
            BranchId = branchId,
            OrderId = orderId,
            KitchenStationId = stationId,
            Number = number,
        };
        foreach (var orderItemId in orderItemIds)
        {
            ticket.Items.Add(new KitchenTicketItem { TicketId = ticket.Id, OrderItemId = orderItemId });
        }

        return ticket;
    }

    /// <summary>Start cooking the whole ticket: <c>new → in_progress</c>, new items → preparing.</summary>
    public IReadOnlyList<KitchenTicketItem> Start(DateTime utcNow)
    {
        TransitionTo(KitchenTicketStatus.InProgress);
        StartedAt ??= utcNow;
        var changed = ActiveItems.Where(i => i.Status == KitchenTicketItemStatus.New).ToList();
        changed.ForEach(i => i.Status = KitchenTicketItemStatus.Preparing);
        return changed;
    }

    /// <summary>Whole ticket ready: every active item → ready.</summary>
    public IReadOnlyList<KitchenTicketItem> MarkReady(DateTime utcNow)
    {
        TransitionTo(KitchenTicketStatus.Ready);
        StartedAt ??= utcNow;
        ReadyAt = utcNow;
        var changed = ActiveItems.Where(i => i.Status != KitchenTicketItemStatus.Ready).ToList();
        changed.ForEach(i => i.Status = KitchenTicketItemStatus.Ready);
        return changed;
    }

    public void MarkServed() => TransitionTo(KitchenTicketStatus.Served);

    /// <summary>Recall (mistake): <c>ready → in_progress</c>, ready items → preparing.</summary>
    public IReadOnlyList<KitchenTicketItem> Recall()
    {
        if (Status != KitchenTicketStatus.Ready)
        {
            throw new DomainException(KitchenErrors.InvalidTransition(Status, KitchenTicketStatus.InProgress));
        }

        Status = KitchenTicketStatus.InProgress;
        ReadyAt = null;
        var changed = ActiveItems.Where(i => i.Status == KitchenTicketItemStatus.Ready).ToList();
        changed.ForEach(i => i.Status = KitchenTicketItemStatus.Preparing);
        return changed;
    }

    public KitchenTicketItem StartItem(Guid ticketItemId, DateTime utcNow)
    {
        var item = GetItem(ticketItemId);
        EnsureItemTransition(item, KitchenTicketItemStatus.New, KitchenTicketItemStatus.Preparing);
        item.Status = KitchenTicketItemStatus.Preparing;
        if (Status == KitchenTicketStatus.New)
        {
            Status = KitchenTicketStatus.InProgress;
            StartedAt ??= utcNow;
        }

        return item;
    }

    public KitchenTicketItem MarkItemReady(Guid ticketItemId, DateTime utcNow)
    {
        var item = GetItem(ticketItemId);
        if (item.Status is not (KitchenTicketItemStatus.New or KitchenTicketItemStatus.Preparing) || !IsOpen)
        {
            throw new DomainException(KitchenErrors.InvalidItemTransition(item.Status, KitchenTicketItemStatus.Ready));
        }

        item.Status = KitchenTicketItemStatus.Ready;
        StartedAt ??= utcNow;
        SyncFromItems(utcNow);
        return item;
    }

    /// <summary>The order item was cancelled: cancel its ticket item; the ticket follows its remaining items.</summary>
    public bool CancelOrderItem(Guid orderItemId, DateTime utcNow)
    {
        var item = Items.FirstOrDefault(i => i.OrderItemId == orderItemId && i.Status != KitchenTicketItemStatus.Cancelled);
        if (item is null || !IsOpen)
        {
            return false;
        }

        item.Status = KitchenTicketItemStatus.Cancelled;
        SyncFromItems(utcNow);
        return true;
    }

    /// <summary>The whole order was cancelled.</summary>
    public void Cancel()
    {
        TransitionTo(KitchenTicketStatus.Cancelled);
        foreach (var item in Items.Where(i => i.Status != KitchenTicketItemStatus.Ready))
        {
            item.Status = KitchenTicketItemStatus.Cancelled;
        }
    }

    public static bool CanTransition(KitchenTicketStatus from, KitchenTicketStatus to) => (from, to) switch
    {
        (KitchenTicketStatus.New, KitchenTicketStatus.InProgress) => true,
        (KitchenTicketStatus.New or KitchenTicketStatus.InProgress, KitchenTicketStatus.Ready) => true,
        (KitchenTicketStatus.Ready, KitchenTicketStatus.Served) => true,
        (KitchenTicketStatus.Ready, KitchenTicketStatus.InProgress) => true,
        (KitchenTicketStatus.New or KitchenTicketStatus.InProgress or KitchenTicketStatus.Ready, KitchenTicketStatus.Cancelled) => true,
        _ => false,
    };

    private void SyncFromItems(DateTime utcNow)
    {
        var active = ActiveItems.ToList();
        if (active.Count == 0)
        {
            Status = KitchenTicketStatus.Cancelled;
        }
        else if (active.All(i => i.Status == KitchenTicketItemStatus.Ready) && Status != KitchenTicketStatus.Ready)
        {
            Status = KitchenTicketStatus.Ready;
            ReadyAt = utcNow;
        }
        else if (Status == KitchenTicketStatus.New && active.Any(i => i.Status != KitchenTicketItemStatus.New))
        {
            Status = KitchenTicketStatus.InProgress;
        }
    }

    private KitchenTicketItem GetItem(Guid ticketItemId) =>
        Items.FirstOrDefault(i => i.Id == ticketItemId) ?? throw new DomainException(KitchenErrors.TicketItemNotFound);

    private void EnsureItemTransition(KitchenTicketItem item, KitchenTicketItemStatus expected, KitchenTicketItemStatus target)
    {
        if (item.Status != expected || !IsOpen || Status == KitchenTicketStatus.Ready)
        {
            throw new DomainException(KitchenErrors.InvalidItemTransition(item.Status, target));
        }
    }

    private void TransitionTo(KitchenTicketStatus target)
    {
        if (!CanTransition(Status, target))
        {
            throw new DomainException(KitchenErrors.InvalidTransition(Status, target));
        }

        Status = target;
    }
}
