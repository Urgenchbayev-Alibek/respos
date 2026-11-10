using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;
using static Restaurant.UnitTests.Orders.OrderTestData;

namespace Restaurant.UnitTests.Orders;

public sealed class OrderBillTests
{
    private static readonly OrderPricingSettings Service10 = new(ServiceChargePercent: 10m, TaxPercent: 0m);

    [Theory]
    [InlineData(100.0, 3, new[] { 33.33, 33.33, 33.34 })]
    [InlineData(200.0, 3, new[] { 66.67, 66.67, 66.66 })]
    [InlineData(100001.0, 2, new[] { 50000.5, 50000.5 })]
    [InlineData(0.05, 4, new[] { 0.01, 0.01, 0.01, 0.02 })]
    public void Equal_split_rounds_and_puts_the_remainder_on_the_last_bill(double totalValue, int parts, double[] expected)
    {
        var total = (decimal)totalValue;
        var amounts = BillSplitter.Equal(total, parts);

        amounts.Should().Equal(expected.Select(e => (decimal)e));
        amounts.Sum().Should().Be(total);
    }

    [Fact]
    public void Equal_split_that_would_create_a_zero_bill_is_rejected()
    {
        var act = () => BillSplitter.Equal(0.02m, 3);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.invalid_split");
    }

    [Fact]
    public void Custom_amounts_must_sum_to_the_total()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (10000m, 1m));

        var mismatch = () => order.SplitByAmounts([4000m, 5000m]);

        mismatch.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.split_mismatch");
        order.SplitByAmounts([4000m, 6000m]).Select(b => b.Amount).Should().Equal(4000m, 6000m);
        order.IsSplit.Should().BeTrue();
    }

    [Fact]
    public void Split_by_items_allocates_partial_quantities_proportionally_and_leftovers_form_the_last_bill()
    {
        var order = OrderWithItems(Service10, (45000m, 2m), (8000m, 1m)); // subtotal 98 000, total 107 800
        var plov = order.Items[0];

        var bills = order.SplitByItems([[new BillItemAllocation(plov.Id, 1m)]]);

        bills.Should().HaveCount(2);
        bills[0].Amount.Should().Be(49500m);                               // 107 800 × 45 000 / 98 000
        bills[1].Amount.Should().Be(58300m);                               // remainder: plov ×1 + tea
        bills[1].Items.Should().HaveCount(2);
        bills.Sum(b => b.Amount).Should().Be(order.Total);
        order.Items.Should().HaveCount(2, "order items are not split into rows (kitchen tickets keep their references)");
    }

    [Fact]
    public void Over_allocating_an_item_is_rejected()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (1000m, 1m), (2000m, 1m));
        var item = order.Items[0];

        var act = () => order.SplitByItems([[new BillItemAllocation(item.Id, 1m)], [new BillItemAllocation(item.Id, 0.5m)]]);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.invalid_split");
    }

    [Fact]
    public void Paying_every_bill_marks_the_order_paid_and_a_split_order_is_locked()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (100m, 1m));
        var bills = order.SplitEqually(3);

        var wholeOrder = () => order.RegisterPayment(10m, null, Now);
        var addItem = () => order.AddItem(Item(500m), OrderPricingSettings.None, null, Now);
        var discount = () => order.ApplyDiscount(DiscountType.Percent, 10m, OrderPricingSettings.None);
        var overpay = () => order.RegisterBillPayment(bills[0].Id, 40m, null, Now);

        wholeOrder.Should().Throw<DomainException>().Which.Error.Code.Should().Be("payment.bill_required");
        addItem.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.split_active");
        discount.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.split_active");
        overpay.Should().Throw<DomainException>().Which.Error.Code.Should().Be("payment.exceeds_due");

        foreach (var bill in bills)
        {
            order.Status.Should().NotBe(OrderStatus.Paid);
            order.RegisterBillPayment(bill.Id, bill.Amount, null, Now);
            bill.Status.Should().Be(OrderBillStatus.Paid);
        }

        order.Status.Should().Be(OrderStatus.Paid);
        order.PaidAmount.Should().Be(100m);
    }

    [Fact]
    public void Merge_is_allowed_only_without_payments_and_a_refund_reopens_the_bill()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (100m, 1m));
        var bills = order.SplitEqually(2);
        order.RegisterBillPayment(bills[0].Id, 10m, null, Now);

        var merge = () => order.MergeBills();
        merge.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.has_payments");

        order.RegisterBillPayment(bills[0].Id, 40m, null, Now);
        bills[0].Status.Should().Be(OrderBillStatus.Paid);
        order.RegisterBillRefund(bills[0].Id, 50m);
        bills[0].Status.Should().Be(OrderBillStatus.Open);

        order.MergeBills();
        order.IsSplit.Should().BeFalse();
        order.Bills.Should().BeEmpty();
    }
}
