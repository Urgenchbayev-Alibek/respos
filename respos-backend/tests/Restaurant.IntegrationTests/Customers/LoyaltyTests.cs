using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Features.Customers.EventHandlers;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Customers;

[Collection(ApiCollection.Name)]
public sealed class LoyaltyTests(ApiFactory factory) : CustomersTestBase(factory)
{
    [Fact]
    public async Task Paid_order_earns_points_once_and_disabled_program_earns_nothing()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        var customerId = Id(await CreateCustomerAsync(client, "901112233"));

        var before = await PaidOrderForAsync(client, seed, customerId);
        (await PointsAsync(client, customerId)).Should().Be(0m);

        await EnableLoyaltyAsync(client);
        var orderId = await PaidOrderForAsync(client, seed, customerId);
        await WithDbAsync(async (db, services) =>
        {
            var handler = services.GetServices<IDomainEventHandler<OrderPaidDomainEvent>>().OfType<EarnPointsOnOrderPaidHandler>().Single();
            await handler.HandleAsync(new OrderPaidDomainEvent(orderId, org.BranchId), default);
            await db.SaveChangesAsync();
            (await db.LoyaltyTransactions.IgnoreQueryFilters().CountAsync(t => t.OrderId == orderId && t.Type == LoyaltyTransactionType.Earn))
                .Should().Be(1);
            (await db.LoyaltyTransactions.IgnoreQueryFilters().CountAsync(t => t.OrderId == before)).Should().Be(0);
        });

        (await PointsAsync(client, customerId)).Should().Be(4500m);
        var ledger = await LedgerAsync(client, customerId);
        ledger.Should().ContainSingle();
        ledger[0].GetProperty("type").GetString().Should().Be("earn");
        ledger[0].GetProperty("reason").GetString().Should().Be("order_paid");
        ledger[0].GetProperty("balanceAfter").GetDecimal().Should().Be(4500m);
        ledger[0].GetProperty("orderNumber").GetInt32().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Redeem_respects_balance_max_share_and_single_redemption()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        await EnableLoyaltyAsync(client, maxRedeemPercent: 5m);
        var customerId = Id(await CreateCustomerAsync(client, "901112233"));
        await PaidOrderForAsync(client, seed, customerId);
        var orderId = Id(await CreateOrderAsync(client, null, Line(seed.PlovId)));

        var noCustomer = await RedeemAsync(client, orderId, 100m);
        await AttachAsync(client, orderId, customerId);
        var info = await ReadJsonAsync(await client.GetAsync($"/api/v1/orders/{orderId}/loyalty"));
        var insufficient = await RedeemAsync(client, orderId, 5000m);
        var overLimit = await RedeemAsync(client, orderId, 3000m);
        var fractional = await RedeemAsync(client, orderId, 10.5m);
        var ok = await RedeemAsync(client, orderId, 2000m);
        var again = await RedeemAsync(client, orderId, 100m);
        var changeGuest = await client.DeleteAsync($"/api/v1/orders/{orderId}/customer");

        (await ReadErrorCodeAsync(noCustomer)).Should().Be("loyalty.no_customer");
        info.GetProperty("points").GetDecimal().Should().Be(4500m);
        info.GetProperty("maxRedeemable").GetDecimal().Should().Be(2250m);
        info.GetProperty("expectedEarn").GetDecimal().Should().Be(4500m);
        (await ReadErrorCodeAsync(insufficient)).Should().Be("loyalty.insufficient_points");
        overLimit.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(overLimit)).Should().Be("loyalty.exceeds_limit");
        fractional.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        ok.StatusCode.Should().Be(HttpStatusCode.OK, await ok.Content.ReadAsStringAsync());
        var order = await ReadJsonAsync(ok);
        order.GetProperty("loyaltyDiscountAmount").GetDecimal().Should().Be(2000m);
        order.GetProperty("discountAmount").GetDecimal().Should().Be(2000m);
        order.GetProperty("total").GetDecimal().Should().Be(PlovPrice - 2000m);
        order.GetProperty("customer").GetProperty("points").GetDecimal().Should().Be(2500m);
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(again)).Should().Be("loyalty.already_redeemed");
        (await ReadErrorCodeAsync(changeGuest)).Should().Be("loyalty.redemption_active");

        await PayRemainingAsync(client, orderId);
        (await PointsAsync(client, customerId)).Should().Be(2500m + 4300m);
    }

    [Fact]
    public async Task Cancelling_redemption_or_order_returns_points()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        await EnableLoyaltyAsync(client);
        var customerId = Id(await CreateCustomerAsync(client, "901112233"));
        await PaidOrderForAsync(client, seed, customerId);
        var orderId = Id(await CreateOrderAsync(client, null, Line(seed.PlovId)));
        await AttachAsync(client, orderId, customerId);

        (await RedeemAsync(client, orderId, 1000m)).StatusCode.Should().Be(HttpStatusCode.OK);
        var cleared = await ReadJsonAsync(await client.DeleteAsync($"/api/v1/orders/{orderId}/loyalty/redeem"));
        cleared.GetProperty("total").GetDecimal().Should().Be(PlovPrice);
        (await PointsAsync(client, customerId)).Should().Be(4500m);

        (await RedeemAsync(client, orderId, 3000m)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await PointsAsync(client, customerId)).Should().Be(1500m);
        var cancel = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/cancel", new { reason = "гость ушёл" }, Json);
        cancel.StatusCode.Should().Be(HttpStatusCode.OK, await cancel.Content.ReadAsStringAsync());

        (await PointsAsync(client, customerId)).Should().Be(4500m);
        var reasons = (await LedgerAsync(client, customerId)).Select(t => t.GetProperty("reason").GetString()).ToList();
        reasons.Should().Contain(["order_redeemed", "redemption_cancelled", "order_cancelled"]);
    }

    [Fact]
    public async Task Refunds_reverse_earned_and_return_redeemed_points_proportionally()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        await EnableLoyaltyAsync(client);
        var customerId = Id(await CreateCustomerAsync(client, "901112233"));
        await PaidOrderForAsync(client, seed, customerId);
        var orderId = Id(await CreateOrderAsync(client, null, Line(seed.PlovId)));
        await AttachAsync(client, orderId, customerId);
        (await RedeemAsync(client, orderId, 4000m)).StatusCode.Should().Be(HttpStatusCode.OK);
        var payment = await PayRemainingAsync(client, orderId);
        (await PointsAsync(client, customerId)).Should().Be(4500m - 4000m + 4100m);

        var half = await PostWithKeyAsync(client, $"/api/v1/payments/{Id(payment)}/refunds", new { amount = 20500m, reason = "половина" });
        half.StatusCode.Should().Be(HttpStatusCode.Created, await half.Content.ReadAsStringAsync());
        (await PointsAsync(client, customerId)).Should().Be(4600m - 2050m + 2000m);

        var rest = await PostWithKeyAsync(client, $"/api/v1/payments/{Id(payment)}/refunds", new { amount = 20500m, reason = "остаток" });
        rest.StatusCode.Should().Be(HttpStatusCode.Created);
        (await PointsAsync(client, customerId)).Should().Be(4500m);
        var refundEntries = (await LedgerAsync(client, customerId)).Where(t => t.GetProperty("reason").GetString() == "refund").ToList();
        refundEntries.Should().HaveCount(4);
        refundEntries.Should().OnlyContain(t => t.GetProperty("type").GetString() == "reverse");
    }

    [Fact]
    public async Task Below_min_order_or_disabled_program_rejects_redemption()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        await EnableLoyaltyAsync(client, minOrderAmount: 10000m);
        var customerId = Id(await CreateCustomerAsync(client, "901112233"));
        await PaidOrderForAsync(client, seed, customerId);
        var teaOrder = Id(await CreateOrderAsync(client, null, Line(seed.TeaId)));
        await AttachAsync(client, teaOrder, customerId);

        var belowMin = await RedeemAsync(client, teaOrder, 100m);
        var invalidSettings = await client.PutAsJsonAsync("/api/v1/loyalty/settings",
            new { isEnabled = true, earnPercent = 120, maxRedeemPercent = 10, minOrderAmount = 0 }, Json);
        var disable = await client.PutAsJsonAsync("/api/v1/loyalty/settings",
            new { isEnabled = false, earnPercent = 10, maxRedeemPercent = 50, minOrderAmount = 0 }, Json);
        var disabled = await RedeemAsync(client, teaOrder, 100m);
        await PayRemainingAsync(client, teaOrder);

        (await ReadErrorCodeAsync(belowMin)).Should().Be("loyalty.below_min_order");
        invalidSettings.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        disable.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadErrorCodeAsync(disabled)).Should().Be("loyalty.disabled");
        (await PointsAsync(client, customerId)).Should().Be(4500m);
        var settings = await ReadJsonAsync(await client.GetAsync("/api/v1/loyalty/settings"));
        settings.GetProperty("isEnabled").GetBoolean().Should().BeFalse();
    }
}
