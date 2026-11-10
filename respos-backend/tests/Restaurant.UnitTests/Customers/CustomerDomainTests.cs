using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;
using Restaurant.UnitTests.Orders;

namespace Restaurant.UnitTests.Customers;

public sealed class CustomerPhoneTests
{
    [Theory]
    [InlineData("+998 90 123 45 67", "+998901234567")]
    [InlineData("998901234567", "+998901234567")]
    [InlineData("90 123-45-67", "+998901234567")]
    [InlineData("(93) 765 43 21", "+998937654321")]
    [InlineData("  +998(71)2001020 ", "+998712001020")]
    public void Valid_numbers_are_normalized(string input, string expected)
    {
        CustomerPhone.TryNormalize(input, out var normalized).Should().BeTrue();
        normalized.Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("+7 900 123 45 67")]
    [InlineData("+901234567")]
    [InlineData("90123456a7")]
    [InlineData("99890123456789")]
    [InlineData("90+1234567")]
    public void Invalid_numbers_are_rejected(string? input) =>
        CustomerPhone.TryNormalize(input, out _).Should().BeFalse();

    [Theory]
    [InlineData("+998 90 123", "99890123")]
    [InlineData("998901234567", "901234567")]
    [InlineData("90-12", "9012")]
    public void Search_digits_drop_a_full_country_code_only(string term, string expected) =>
        CustomerPhone.SearchDigits(term).Should().Be(expected);

    [Fact]
    public void Customer_tags_are_cleaned_and_birthday_key_is_set()
    {
        var customer = Customer.Create(Guid.NewGuid(), "901234567", "  Азиз ");
        customer.SetTags(["VIP", " vip", "", "Семья"]);
        customer.SetBirthday(new DateOnly(1990, 2, 28));

        customer.Name.Should().Be("Азиз");
        customer.Tags.Should().Equal("vip", "семья");
        customer.IsVip.Should().BeTrue();
        customer.BirthdayKey.Should().Be(228);
        FluentActions.Invoking(() => customer.SetPhone("123")).Should().Throw<DomainException>()
            .Which.Error.Should().Be(CustomerErrors.InvalidPhone);
    }

    [Fact]
    public void Birthday_keys_cover_the_window_and_feb_29_in_non_leap_years()
    {
        Customer.BirthdayKeys(new DateOnly(2026, 12, 30), 3).Should().BeEquivalentTo([1230, 1231, 101]);
        Customer.BirthdayKeys(new DateOnly(2027, 2, 28), 1).Should().BeEquivalentTo([228, 229]);
    }
}

public sealed class LoyaltyAccountTests
{
    private static readonly DateTime Now = OrderTestData.Now;

    [Fact]
    public void Redeem_consumes_earliest_expiring_lots_first_and_checks_balance()
    {
        var account = LoyaltyAccount.Open(Guid.NewGuid(), Guid.NewGuid(), Now);
        var late = account.Earn(Guid.NewGuid(), 100m, Now.AddDays(30), Now, null);
        var early = account.Earn(Guid.NewGuid(), 50m, Now.AddDays(5), Now, null);

        account.Redeem(Guid.NewGuid(), 70m, Now, null);

        account.Balance.Should().Be(80m);
        early.RemainingPoints.Should().Be(0m);
        late.RemainingPoints.Should().Be(80m);
        account.LifetimeEarned.Should().Be(150m);
        account.LifetimeRedeemed.Should().Be(70m);
        FluentActions.Invoking(() => account.Redeem(Guid.NewGuid(), 81m, Now, null)).Should().Throw<DomainException>()
            .Which.Error.Should().Be(LoyaltyErrors.InsufficientPoints);
        FluentActions.Invoking(() => account.Redeem(Guid.NewGuid(), 1.5m, Now, null)).Should().Throw<DomainException>()
            .Which.Error.Should().Be(LoyaltyErrors.InvalidPoints);
    }

    [Fact]
    public void Expired_lots_are_written_off_once()
    {
        var account = LoyaltyAccount.Open(Guid.NewGuid(), Guid.NewGuid(), Now);
        account.Earn(Guid.NewGuid(), 100m, Now.AddDays(1), Now, null);
        account.Earn(Guid.NewGuid(), 40m, null, Now, null);

        var expired = account.ExpireDue(Now.AddDays(2));
        var again = account.ExpireDue(Now.AddDays(3));

        expired.Should().ContainSingle().Which.Points.Should().Be(-100m);
        expired[0].Type.Should().Be(LoyaltyTransactionType.Expire);
        again.Should().BeEmpty();
        account.Balance.Should().Be(40m);
    }

    [Fact]
    public void Reversing_earned_points_prefers_the_orders_lot_and_never_goes_negative()
    {
        var account = LoyaltyAccount.Open(Guid.NewGuid(), Guid.NewGuid(), Now);
        var orderId = Guid.NewGuid();
        var other = account.Earn(Guid.NewGuid(), 30m, Now.AddDays(1), Now, null);
        var own = account.Earn(orderId, 50m, Now.AddDays(10), Now, null);
        account.Redeem(Guid.NewGuid(), 60m, Now, null);

        var reversed = account.ReverseEarned(orderId, 50m, Now, null);

        reversed!.Points.Should().Be(-20m);
        account.Balance.Should().Be(0m);
        (other.RemainingPoints + own.RemainingPoints).Should().Be(0m);
        account.ReverseEarned(orderId, 10m, Now, null).Should().BeNull();
        account.ReturnRedeemed(orderId, 25m, LoyaltyReason.Refund, null, Now, null)!.RemainingPoints.Should().Be(25m);
        account.Balance.Should().Be(25m);
    }

    [Fact]
    public void Settings_validate_ranges_and_compute_points()
    {
        var settings = LoyaltySettings.Default(Guid.NewGuid());
        settings.Update(true, 5m, 30m, 10000m, 90);

        settings.Qualifies(9999m).Should().BeFalse();
        settings.Qualifies(10000m).Should().BeTrue();
        settings.PointsFor(45999m).Should().Be(2299m);
        settings.MaxRedeemFor(45000m).Should().Be(13500m);
        settings.ExpiryFrom(Now).Should().Be(Now.AddDays(90));
        FluentActions.Invoking(() => settings.Update(true, 101m, 30m, 0m, null)).Should().Throw<DomainException>();
        FluentActions.Invoking(() => settings.Update(true, 5m, 30m, 0m, 0)).Should().Throw<DomainException>();
    }
}

public sealed class OrderLoyaltyTests
{
    private static readonly OrderPricingSettings Pricing = new(10m, 0m);

    [Fact]
    public void Loyalty_discount_adds_to_manual_discount_and_service_is_charged_on_the_rest()
    {
        var order = OrderTestData.OrderWithItems(Pricing, (45000m, 1m));
        order.AttachCustomer(Guid.NewGuid());
        order.ApplyDiscount(DiscountType.Percent, 10m, Pricing);

        order.LoyaltyBase.Should().Be(40500m);
        order.ApplyLoyaltyDiscount(5000m, Pricing);

        order.DiscountAmount.Should().Be(9500m);
        order.ServiceChargeAmount.Should().Be(3550m);
        order.Total.Should().Be(39050m);
        FluentActions.Invoking(() => order.ApplyLoyaltyDiscount(100m, Pricing)).Should().Throw<DomainException>()
            .Which.Error.Should().Be(LoyaltyErrors.AlreadyRedeemed);
        FluentActions.Invoking(() => order.AttachCustomer(Guid.NewGuid())).Should().Throw<DomainException>()
            .Which.Error.Should().Be(LoyaltyErrors.RedemptionActive);
        order.ClearLoyaltyDiscount(Pricing).Should().Be(5000m);
        order.Total.Should().Be(44550m);
    }

    [Fact]
    public void Loyalty_discount_is_clamped_when_items_are_cancelled_and_requires_a_customer()
    {
        var order = OrderTestData.NewOrder();
        var plov = OrderTestData.Item(45000m);
        var tea = OrderTestData.Item(8000m);
        order.AddItem(plov, OrderPricingSettings.None, null, OrderTestData.Now);
        order.AddItem(tea, OrderPricingSettings.None, null, OrderTestData.Now);
        FluentActions.Invoking(() => order.ApplyLoyaltyDiscount(100m, OrderPricingSettings.None)).Should().Throw<DomainException>()
            .Which.Error.Should().Be(LoyaltyErrors.NoCustomer);
        order.AttachCustomer(Guid.NewGuid());
        order.ApplyLoyaltyDiscount(20000m, OrderPricingSettings.None);

        order.CancelItem(plov.Id, "ошибка", OrderPricingSettings.None, null, OrderTestData.Now);

        order.LoyaltyDiscountAmount.Should().Be(8000m);
        order.DiscountAmount.Should().Be(8000m);
        order.Total.Should().Be(0m);
    }
}
