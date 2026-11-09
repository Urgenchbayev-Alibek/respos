using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.UnitTests.Orders;

internal static class OrderTestData
{
    public static readonly DateTime Now = new(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc);

    public static Order NewOrder(OrderType type = OrderType.DineIn) =>
        Order.Create(Guid.NewGuid(), Guid.NewGuid(), type, type == OrderType.DineIn ? Guid.NewGuid() : null,
            Guid.NewGuid(), 2, 1, DateOnly.FromDateTime(Now), null, Now);

    public static OrderItem Item(decimal unitPrice, decimal quantity = 1m) =>
        OrderItem.Create(Guid.NewGuid(), "Плов", unitPrice, quantity);

    public static Order OrderWithItems(OrderPricingSettings settings, params (decimal Price, decimal Qty)[] lines)
    {
        var order = NewOrder();
        foreach (var (price, qty) in lines)
        {
            order.AddItem(Item(price, qty), settings, null, Now);
        }

        return order;
    }
}
