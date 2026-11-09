using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;
using static Restaurant.UnitTests.Orders.OrderTestData;

namespace Restaurant.UnitTests.Orders;

public sealed class OrderOperationsTests
{
    private static readonly OrderPricingSettings ServiceAndTax = new(ServiceChargePercent: 10m, TaxPercent: 12m);

    [Fact]
    public void Amount_discount_service_and_tax_round_away_from_zero()
    {
        var order = OrderWithItems(ServiceAndTax, (12345.55m, 1m), (0.05m, 1m));

        order.ApplyDiscount(DiscountType.Amount, 100.005m, ServiceAndTax);

        order.Subtotal.Should().Be(12345.60m);
        order.DiscountAmount.Should().Be(100.01m);        // amount rounded away from zero
        order.ServiceChargeAmount.Should().Be(1224.56m);  // 12245.59 * 10% = 1224.559
        order.TaxAmount.Should().Be(1616.42m);            // 13470.15 * 12% = 1616.418
        order.Total.Should().Be(15086.57m);
        order.RemainingAmount.Should().Be(order.Total);
    }

    [Fact]
    public void Cancelling_an_item_recalculates_totals_and_status()
    {
        var order = OrderWithItems(ServiceAndTax, (10000m, 2m), (5000m, 1m));
        order.SendItems(null, null, Now);

        order.CancelItem(order.Items[1].Id, "ошибка официанта", ServiceAndTax, null, Now);

        order.Subtotal.Should().Be(20000m);
        order.Total.Should().Be(Money.Round(20000m * 1.1m * 1.12m));
        order.Status.Should().Be(OrderStatus.Submitted);
    }

    [Fact]
    public void Item_cannot_be_cancelled_below_the_paid_amount()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (10000m, 1m), (5000m, 1m));
        order.RegisterPayment(12000m, null, Now);

        var act = () => order.CancelItem(order.Items[1].Id, "нет в наличии", OrderPricingSettings.None, null, Now);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.has_payments");
    }

    [Fact]
    public void Only_new_items_can_be_updated()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (10000m, 1m));
        order.UpdateItem(order.Items[0].Id, 3m, "без лука", OrderPricingSettings.None);
        order.Total.Should().Be(30000m);
        order.Items[0].Comment.Should().Be("без лука");

        order.SendItems(null, null, Now);
        var act = () => order.UpdateItem(order.Items[0].Id, 1m, null, OrderPricingSettings.None);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.item_not_editable");
    }

    [Fact]
    public void Kitchen_progress_recall_and_serving_recompute_the_order_status()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (10000m, 1m), (5000m, 1m));
        order.SendItems(null, null, Now);
        var (first, second) = (order.Items[0].Id, order.Items[1].Id);

        order.StartItemPreparing(first, null, Now);
        order.Status.Should().Be(OrderStatus.InProgress);
        order.MarkItemReady(first, null, Now);
        order.MarkItemReady(second, null, Now);
        order.Status.Should().Be(OrderStatus.Ready);

        order.RecallItem(second, null, Now);
        order.Status.Should().Be(OrderStatus.PartiallyReady);
        order.MarkItemReady(second, null, Now);

        order.ServeItem(first, null, Now);
        order.Status.Should().Be(OrderStatus.Ready);
        order.ServeAllReady(null, Now).Should().HaveCount(1);
        order.Status.Should().Be(OrderStatus.Served);
    }

    [Fact]
    public void Serving_an_item_that_is_not_ready_is_rejected()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (10000m, 1m));
        order.SendItems(null, null, Now);

        var act = () => order.ServeItem(order.Items[0].Id, null, Now);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.invalid_status_transition");
    }

    [Fact]
    public void Partial_send_only_sends_selected_new_items()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (10000m, 1m), (5000m, 1m));

        var sent = order.SendItems([order.Items[0].Id], null, Now);

        sent.Should().ContainSingle().Which.Id.Should().Be(order.Items[0].Id);
        order.Items[1].Status.Should().Be(OrderItemStatus.New);
        order.Status.Should().Be(OrderStatus.Submitted);
    }
}
