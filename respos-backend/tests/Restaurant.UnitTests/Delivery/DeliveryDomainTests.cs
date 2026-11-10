using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;
using static Restaurant.UnitTests.Orders.OrderTestData;

namespace Restaurant.UnitTests.Delivery;

public sealed class DeliveryDomainTests
{
    private static readonly OrderPricingSettings ServiceAndTax = new(ServiceChargePercent: 10m, TaxPercent: 12m);

    private static OrderDelivery NewDelivery() => OrderDelivery.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
        new DeliveryAddress(" Алишер ", "+998901234567", " ул. Навои, 5 ", "2", null, " ", "без лука"), Now);

    [Fact]
    public void Happy_path_stamps_every_status()
    {
        var delivery = NewDelivery();
        delivery.CustomerName.Should().Be("Алишер");
        delivery.Apartment.Should().BeNull();

        delivery.ChangeStatus(DeliveryStatus.Accepted, Now.AddMinutes(1));
        delivery.ChangeStatus(DeliveryStatus.Cooking, Now.AddMinutes(2));
        delivery.ChangeStatus(DeliveryStatus.Ready, Now.AddMinutes(20));
        delivery.AssignCourier(Guid.NewGuid());
        delivery.ChangeStatus(DeliveryStatus.OnTheWay, Now.AddMinutes(25));
        delivery.ChangeStatus(DeliveryStatus.Delivered, Now.AddMinutes(50));

        delivery.Status.Should().Be(DeliveryStatus.Delivered);
        delivery.AcceptedAt.Should().Be(Now.AddMinutes(1));
        delivery.ReadyAt.Should().Be(Now.AddMinutes(20));
        delivery.DeliveredAt.Should().Be(Now.AddMinutes(50));
        delivery.StatusChangedAt.Should().Be(Now.AddMinutes(50));
        OrderDelivery.TargetsFrom(delivery.Status).Should().BeEmpty();
    }

    [Theory]
    [InlineData(DeliveryStatus.Cooking)]
    [InlineData(DeliveryStatus.Ready)]
    [InlineData(DeliveryStatus.OnTheWay)]
    [InlineData(DeliveryStatus.Delivered)]
    [InlineData(DeliveryStatus.New)]
    public void Invalid_transitions_from_new_are_conflicts(DeliveryStatus target)
    {
        var act = () => NewDelivery().ChangeStatus(target, Now);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("delivery.invalid_status_transition");
    }

    [Fact]
    public void Delivered_is_terminal_and_cancel_needs_a_reason()
    {
        var delivery = NewDelivery();
        delivery.ChangeStatus(DeliveryStatus.Accepted, Now);

        var noReason = () => delivery.ChangeStatus(DeliveryStatus.Cancelled, Now, " ");
        noReason.Should().Throw<DomainException>().Which.Error.Code.Should().Be("delivery.cancel_reason_required");

        delivery.ChangeStatus(DeliveryStatus.Cancelled, Now, "клиент отказался");
        delivery.CancelReason.Should().Be("клиент отказался");
        var reopen = () => delivery.ChangeStatus(DeliveryStatus.Accepted, Now);
        reopen.Should().Throw<DomainException>().Which.Error.Code.Should().Be("delivery.invalid_status_transition");
        var courier = () => delivery.AssignCourier(Guid.NewGuid());
        courier.Should().Throw<DomainException>().Which.Error.Code.Should().Be("delivery.closed");
    }

    [Fact]
    public void On_the_way_requires_a_courier()
    {
        var delivery = NewDelivery();
        delivery.ChangeStatus(DeliveryStatus.Accepted, Now);
        delivery.ChangeStatus(DeliveryStatus.Ready, Now);

        var act = () => delivery.ChangeStatus(DeliveryStatus.OnTheWay, Now);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("delivery.courier_required");
    }

    [Fact]
    public void Delivery_fee_is_added_after_tax_and_survives_recalculation()
    {
        var order = NewOrder(OrderType.Delivery);
        order.AddItem(Item(10000m, 2m), ServiceAndTax, null, Now);

        order.SetDeliveryFee(15000m, ServiceAndTax);
        order.ApplyDiscount(DiscountType.Percent, 10m, ServiceAndTax);

        order.Subtotal.Should().Be(20000m);
        order.DiscountAmount.Should().Be(2000m);
        order.ServiceChargeAmount.Should().Be(1800m);
        order.TaxAmount.Should().Be(2376m);
        order.DeliveryFee.Should().Be(15000m);
        order.Total.Should().Be(18000m + 1800m + 2376m + 15000m);
    }

    [Fact]
    public void Delivery_fee_only_for_delivery_orders()
    {
        var dineIn = OrderWithItems(ServiceAndTax, (10000m, 1m));
        var totalBefore = dineIn.Total;

        var act = () => dineIn.SetDeliveryFee(5000m, ServiceAndTax);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("order.invalid_delivery_fee");
        dineIn.DeliveryFee.Should().Be(0m);
        dineIn.Total.Should().Be(totalBefore);
    }

    [Fact]
    public void Branch_slug_is_transliterated_and_valid()
    {
        var id = Guid.Parse("1a2b3c4d-0000-0000-0000-000000000000");

        BranchSlug.Generate("Ташкент — Центр", id).Should().Be("tashkent-tsentr-1a2b3c");
        BranchSlug.Generate("!!!", id).Should().Be("branch-1a2b3c");
        BranchSlug.IsValid(BranchSlug.Generate(new string('x', 200), id)).Should().BeTrue();
        BranchSlug.IsValid("Bad Slug").Should().BeFalse();
        BranchSlug.IsValid("-bad").Should().BeFalse();
        BranchSlug.IsValid("ok-slug-1").Should().BeTrue();
    }
}
