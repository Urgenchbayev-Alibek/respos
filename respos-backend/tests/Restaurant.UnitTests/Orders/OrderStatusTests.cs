using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Domain.Exceptions;
using static Restaurant.UnitTests.Orders.OrderTestData;

namespace Restaurant.UnitTests.Orders;

public sealed class OrderStatusTests
{
    [Fact]
    public void New_order_is_draft_and_sending_items_submits_it()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m));
        order.Status.Should().Be(OrderStatus.Draft);

        var sent = order.SendItems(null, null, Now);

        sent.Should().HaveCount(1);
        order.Status.Should().Be(OrderStatus.Submitted);
        order.Items[0].Status.Should().Be(OrderItemStatus.Sent);
        order.DomainEvents.Should().ContainSingle(e => e is OrderSubmittedDomainEvent);
        order.History.Should().ContainSingle(h => h.FromStatus == OrderStatus.Draft && h.ToStatus == OrderStatus.Submitted);
    }

    [Fact]
    public void Sending_without_new_items_is_rejected()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m));
        order.SendItems(null, null, Now);

        var act = () => order.SendItems(null, null, Now);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.nothing_to_send");
    }

    [Fact]
    public void Status_is_derived_from_item_statuses()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m), (12000m, 1m));
        order.SendItems(null, null, Now);

        order.Items[0].StartPreparing();
        order.SyncStatusFromItems(null, Now);
        order.Status.Should().Be(OrderStatus.InProgress);

        order.MarkItemReady(order.Items[0].Id, null, Now);
        order.Status.Should().Be(OrderStatus.PartiallyReady);
        order.DomainEvents.Should().Contain(e => e is OrderItemReadyDomainEvent);

        order.MarkItemReady(order.Items[1].Id, null, Now);
        order.Status.Should().Be(OrderStatus.Ready);

        order.Items.ForEach(i => i.MarkServed());
        order.SyncStatusFromItems(null, Now);
        order.Status.Should().Be(OrderStatus.Served);
    }

    [Fact]
    public void Adding_items_to_a_served_order_moves_it_back()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m));
        order.SendItems(null, null, Now);
        order.MarkItemReady(order.Items[0].Id, null, Now);
        order.Items[0].MarkServed();
        order.SyncStatusFromItems(null, Now);

        order.AddItem(Item(8000m), OrderPricingSettings.None, null, Now);

        order.Status.Should().Be(OrderStatus.PartiallyReady);
    }

    [Fact]
    public void Full_payment_marks_order_paid_and_raises_event()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m));
        order.SendItems(null, null, Now);

        order.RegisterPayment(20000m, null, Now);
        order.Status.Should().Be(OrderStatus.Submitted);
        order.RemainingAmount.Should().Be(25000m);

        order.RegisterPayment(25000m, null, Now);

        order.Status.Should().Be(OrderStatus.Paid);
        order.ClosedAt.Should().Be(Now);
        order.DomainEvents.Should().ContainSingle(e => e is OrderPaidDomainEvent);
    }

    [Fact]
    public void Overpayment_is_rejected()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m));

        var act = () => order.RegisterPayment(45000.01m, null, Now);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("payment.exceeds_due");
    }

    [Fact]
    public void Paid_order_cannot_be_cancelled_or_paid_again()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m));
        order.RegisterPayment(45000m, null, Now);

        order.Invoking(o => o.Cancel("ошибка", null, Now)).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("order.invalid_status_transition");
        order.Invoking(o => o.RegisterPayment(1m, null, Now)).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("order.invalid_status_transition");
    }

    [Fact]
    public void Cancel_requires_reason_and_no_payments()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m));
        order.Invoking(o => o.Cancel(" ", null, Now)).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("order.cancel_reason_required");

        order.RegisterPayment(1000m, null, Now);
        order.Invoking(o => o.Cancel("гость ушёл", null, Now)).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("order.has_payments");

        order.RegisterRefund(1000m);
        order.Cancel("гость ушёл", null, Now);
        order.Status.Should().Be(OrderStatus.Cancelled);
        order.Items.Should().OnlyContain(i => i.Status == OrderItemStatus.Cancelled);
    }

    [Theory]
    [InlineData(OrderStatus.Draft, OrderStatus.Submitted, true)]
    [InlineData(OrderStatus.Served, OrderStatus.Submitted, true)]
    [InlineData(OrderStatus.Ready, OrderStatus.Paid, true)]
    [InlineData(OrderStatus.InProgress, OrderStatus.Cancelled, true)]
    [InlineData(OrderStatus.Paid, OrderStatus.Cancelled, false)]
    [InlineData(OrderStatus.Cancelled, OrderStatus.Draft, false)]
    [InlineData(OrderStatus.Paid, OrderStatus.Served, false)]
    [InlineData(OrderStatus.Draft, OrderStatus.Draft, false)]
    public void Transition_table(OrderStatus from, OrderStatus to, bool allowed) =>
        OrderStatusTransitions.CanTransition(from, to).Should().Be(allowed);

    [Fact]
    public void Item_cannot_skip_back_from_served()
    {
        OrderItem.CanTransition(OrderItemStatus.Served, OrderItemStatus.Preparing).Should().BeFalse();
        OrderItem.CanTransition(OrderItemStatus.Ready, OrderItemStatus.Preparing).Should().BeTrue();
    }

    [Fact]
    public void Dine_in_order_requires_table()
    {
        var act = () => Order.Create(Guid.NewGuid(), Guid.NewGuid(), OrderType.DineIn, null, Guid.NewGuid(), 1, 1,
            DateOnly.FromDateTime(Now), null, Now);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.table_required");
    }
}
