using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Orders;

/// <summary>
/// Allowed order status transitions (DOMAIN_MODEL.md + DECISIONS_v1_1 §4).
/// Non-terminal statuses (draft..served) are derived from item statuses and may move between each other
/// (e.g. new items sent after "served"). Any non-terminal → paid (fully paid, total &gt; 0) or
/// → cancelled (only when nothing is paid). paid / cancelled are terminal.
/// </summary>
public static class OrderStatusTransitions
{
    private static readonly OrderStatus[] NonTerminal =
    [
        OrderStatus.Draft, OrderStatus.Submitted, OrderStatus.InProgress,
        OrderStatus.PartiallyReady, OrderStatus.Ready, OrderStatus.Served,
    ];

    public static bool IsTerminal(OrderStatus status) => status is OrderStatus.Paid or OrderStatus.Cancelled;

    public static bool CanTransition(OrderStatus from, OrderStatus to) =>
        from != to && !IsTerminal(from) && (NonTerminal.Contains(to) || IsTerminal(to));

    public static IReadOnlyCollection<OrderStatus> TargetsFrom(OrderStatus from) =>
        IsTerminal(from)
            ? []
            : [.. NonTerminal.Where(s => s != from), OrderStatus.Paid, OrderStatus.Cancelled];

    /// <summary>
    /// Derives the status from active (non-cancelled) items (DECISIONS_v1_1 §4):
    /// nothing sent → draft; all served → served; all ready|served (≥1 ready) → ready;
    /// some ready|served and some not → partially_ready; any preparing → in_progress; else submitted.
    /// </summary>
    public static OrderStatus DeriveFromItems(IEnumerable<OrderItemStatus> itemStatuses)
    {
        var active = itemStatuses.Where(s => s != OrderItemStatus.Cancelled).ToList();
        if (active.All(s => s == OrderItemStatus.New))
        {
            return OrderStatus.Draft;
        }

        if (active.All(s => s == OrderItemStatus.Served))
        {
            return OrderStatus.Served;
        }

        var doneCount = active.Count(s => s is OrderItemStatus.Ready or OrderItemStatus.Served);
        if (doneCount == active.Count)
        {
            return OrderStatus.Ready;
        }

        if (doneCount > 0)
        {
            return OrderStatus.PartiallyReady;
        }

        return active.Any(s => s == OrderItemStatus.Preparing) ? OrderStatus.InProgress : OrderStatus.Submitted;
    }
}
