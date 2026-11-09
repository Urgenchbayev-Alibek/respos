using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;
using static Restaurant.UnitTests.Orders.OrderTestData;

namespace Restaurant.UnitTests.Orders;

public sealed class OrderPricingTests
{
    [Fact]
    public void LineTotal_includes_modifiers_times_quantity()
    {
        var item = Item(45000m, 2m);
        item.AddModifier(Guid.NewGuid(), "Лепёшка", 5000m);
        item.AddModifier(Guid.NewGuid(), "Соус", 3000m);

        item.LineTotal.Should().Be(106000m);
    }

    [Fact]
    public void LineTotal_with_fractional_quantity_is_rounded_away_from_zero()
    {
        var item = Item(10.05m, 0.5m);

        item.LineTotal.Should().Be(5.03m);
    }

    [Fact]
    public void Subtotal_excludes_cancelled_items()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m), (12000m, 2m));
        order.Items[1].Cancel("Гость передумал");

        order.RecalculateTotals(OrderPricingSettings.None);

        order.Subtotal.Should().Be(45000m);
        order.Total.Should().Be(45000m);
    }

    [Fact]
    public void Totals_apply_discount_service_charge_and_tax_in_contract_order()
    {
        var settings = new OrderPricingSettings(ServiceChargePercent: 10m, TaxPercent: 12m);
        var order = OrderWithItems(settings, (33333m, 1m));

        order.ApplyDiscount(DiscountType.Percent, 15m, settings);

        order.Subtotal.Should().Be(33333m);
        order.DiscountAmount.Should().Be(4999.95m);       // 33333 * 15%
        order.ServiceChargeAmount.Should().Be(2833.31m);  // 28333.05 * 10% = 2833.305 -> away from zero
        order.TaxAmount.Should().Be(3739.96m);            // 31166.36 * 12% = 3739.9632
        order.Total.Should().Be(34906.32m);
    }

    [Fact]
    public void Amount_discount_is_capped_at_subtotal()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (20000m, 1m));

        order.ApplyDiscount(DiscountType.Amount, 50000m, OrderPricingSettings.None);

        order.DiscountAmount.Should().Be(20000m);
        order.Total.Should().Be(0m);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public void Invalid_percent_discount_is_rejected(int percent)
    {
        var order = OrderWithItems(OrderPricingSettings.None, (20000m, 1m));

        var act = () => order.ApplyDiscount(DiscountType.Percent, percent, OrderPricingSettings.None);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.invalid_discount");
    }

    [Fact]
    public void Zero_percent_settings_keep_total_equal_to_subtotal()
    {
        var order = OrderWithItems(OrderPricingSettings.None, (45000m, 1m), (8000m, 3m));

        order.Subtotal.Should().Be(69000m);
        order.ServiceChargeAmount.Should().Be(0m);
        order.TaxAmount.Should().Be(0m);
        order.Total.Should().Be(69000m);
    }
}
