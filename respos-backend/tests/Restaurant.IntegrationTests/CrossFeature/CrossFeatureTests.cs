using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Restaurant.Domain.Constants;
using Restaurant.IntegrationTests.Branches;
using Restaurant.IntegrationTests.Customers;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.CrossFeature;

/// <summary>
/// Rules where v2 modules meet on one order: loyalty points (F1) × split bills and tips (F2) × delivery fee (F3)
/// × branch price overrides (F4). Pricing: total = subtotal − (manual + points) + service + tax + deliveryFee.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class CrossFeatureTests(ApiFactory factory) : CustomersTestBase(factory)
{
    [Fact]
    public async Task Loyalty_redemption_is_blocked_while_split_and_a_redeemed_order_splits_and_pays_bills_with_a_tip()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var owner = await BranchClientAsync(org);
        var cashier = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Cashier));
        await EnableLoyaltyAsync(owner);
        await OpenShiftAsync(cashier);
        var customerId = Id(await CreateCustomerAsync(cashier, "901234500"));
        await PaidOrderForAsync(owner, seed, customerId); // +4500 points

        var orderId = Id(await CreateOrderAsync(owner, null, Line(seed.PlovId, 2m)));
        await AttachAsync(cashier, orderId, customerId);
        await SplitAsync(cashier, orderId, new { mode = "equal", parts = 2 });

        var blocked = await RedeemAsync(cashier, orderId, 1000m);
        blocked.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(blocked)).Should().Be("order.split_active");
        var loyalty = await ReadJsonAsync(await cashier.GetAsync($"/api/v1/orders/{orderId}/loyalty"));
        loyalty.GetProperty("maxRedeemable").GetDecimal().Should().Be(0m, "points cannot be offered on a split order");
        (await PointsAsync(cashier, customerId)).Should().Be(4500m, "the rejected redemption must not touch the ledger");

        (await cashier.DeleteAsync($"/api/v1/orders/{orderId}/split")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await RedeemAsync(cashier, orderId, 4000m)).StatusCode.Should().Be(HttpStatusCode.OK);
        var split = await SplitAsync(cashier, orderId, new { mode = "equal", parts = 2 });
        split.GetProperty("total").GetDecimal().Should().Be(2 * PlovPrice - 4000m);
        var bills = split.GetProperty("bills").EnumerateArray().Select(b => (Id: Id(b), Amount: b.GetProperty("amount").GetDecimal())).ToList();
        bills.Sum(b => b.Amount).Should().Be(2 * PlovPrice - 4000m);

        var cancel = await cashier.DeleteAsync($"/api/v1/orders/{orderId}/loyalty/redeem");
        cancel.StatusCode.Should().Be(HttpStatusCode.Conflict, "giving points back would change the total behind fixed bills");
        (await ReadErrorCodeAsync(cancel)).Should().Be("order.split_active");

        (await PayBillAsync(cashier, orderId, bills[0].Id, bills[0].Amount)).StatusCode.Should().Be(HttpStatusCode.Created);
        var tipped = await PayBillAsync(cashier, orderId, bills[1].Id, bills[1].Amount, tipAmount: 5000m, method: "card");
        tipped.StatusCode.Should().Be(HttpStatusCode.Created, await tipped.Content.ReadAsStringAsync());
        (await ReadJsonAsync(tipped)).GetProperty("tipAmount").GetDecimal().Should().Be(5000m);

        var paid = await GetOrderAsync(cashier, orderId);
        paid.GetProperty("status").GetString().Should().Be("paid");
        paid.GetProperty("paidAmount").GetDecimal().Should().Be(86000m, "the tip is not part of the order money");
        paid.GetProperty("loyaltyDiscountAmount").GetDecimal().Should().Be(4000m);
        (await PointsAsync(cashier, customerId)).Should().Be(4500m - 4000m + 8600m, "earn = 10 % of the paid total once, after the last bill");
    }

    [Fact]
    public async Task Delivery_order_with_service_charge_points_and_tip_keeps_fee_out_of_the_discount_and_tip_out_of_revenue()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org, servicePercent: 10m);
        var owner = await BranchClientAsync(org);
        var cashier = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Cashier));
        await EnableLoyaltyAsync(owner);
        var fee = await owner.PutAsJsonAsync($"/api/v1/branches/{org.BranchId}/delivery-settings",
            new { slug = $"x-{Guid.NewGuid():N}"[..20], deliveryFee = 15000m }, Json);
        fee.StatusCode.Should().Be(HttpStatusCode.OK, await fee.Content.ReadAsStringAsync());
        var shift = Id(await OpenShiftAsync(cashier));
        var customerId = Id(await CreateCustomerAsync(cashier, "901234501"));
        await PaidOrderForAsync(owner, seed, customerId); // 45000 + 10 % service = 49500 → 4950 points

        var created = await cashier.PostAsJsonAsync("/api/v1/delivery/orders", new
        {
            customerName = "Алишер", customerPhone = "+998 90 123-45-01", address = "ул. Навои, 5", items = new[] { Line(seed.PlovId, 2m) },
        }, Json);
        created.StatusCode.Should().Be(HttpStatusCode.Created, await created.Content.ReadAsStringAsync());
        var orderId = (await ReadJsonAsync(created)).GetProperty("orderId").GetGuid();
        await AttachAsync(cashier, orderId, customerId);
        var redeemed = await ReadJsonAsync(await RedeemAsync(cashier, orderId, 4000m));

        redeemed.GetProperty("discountAmount").GetDecimal().Should().Be(4000m);
        redeemed.GetProperty("serviceChargeAmount").GetDecimal().Should().Be(8600m, "service on (90000 − 4000) food only");
        redeemed.GetProperty("deliveryFee").GetDecimal().Should().Be(15000m);
        redeemed.GetProperty("total").GetDecimal().Should().Be(86000m + 8600m + 15000m);

        var payment = await PayBillAsync(cashier, orderId, null, 109600m, tipAmount: 3000m);
        payment.StatusCode.Should().Be(HttpStatusCode.Created, await payment.Content.ReadAsStringAsync());
        var order = await GetOrderAsync(cashier, orderId);
        order.GetProperty("status").GetString().Should().Be("paid");
        order.GetProperty("paidAmount").GetDecimal().Should().Be(109600m);
        (await PointsAsync(cashier, customerId)).Should().Be(4950m - 4000m + 10960m);

        var cash = await ReadJsonAsync(await cashier.GetAsync($"/api/v1/cash-shifts/{shift}"));
        cash.GetProperty("cashTipsAmount").GetDecimal().Should().Be(3000m);
        cash.GetProperty("expectedCashAmount").GetDecimal().Should().Be(49500m + 109600m + 3000m, "cash tips are in the drawer");
        var tips = await ReadJsonAsync(await owner.GetAsync("/api/v1/reports/tips"));
        tips.GetProperty("totalTips").GetDecimal().Should().Be(3000m);
    }

    [Fact]
    public async Task Branch_price_override_is_the_base_for_points_limit_and_earn()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var seed = await SeedPosAsync(org);
        var branch2 = await BranchTestData.AddBranchAsync(Factory, org);
        var owner = await BranchClientAsync(org);
        await EnableLoyaltyAsync(owner, maxRedeemPercent: 10m);
        await OpenShiftAsync(owner);
        var customerId = Id(await CreateCustomerAsync(owner, "901234502"));
        await PaidOrderForAsync(owner, seed, customerId); // +4500 at the main branch
        var saved = await owner.PutAsJsonAsync($"/api/v1/menu/items/{seed.PlovId}/branches/{branch2}", new { priceOverride = 30000m }, Json);
        saved.StatusCode.Should().Be(HttpStatusCode.OK, await saved.Content.ReadAsStringAsync());

        ClientWithBranch(owner, branch2);
        await OpenShiftAsync(owner);
        var order = await CreateOrderAsync(owner, null, Line(seed.PlovId));
        order.GetProperty("subtotal").GetDecimal().Should().Be(30000m);
        await AttachAsync(owner, Id(order), customerId);
        var loyalty = await ReadJsonAsync(await owner.GetAsync($"/api/v1/orders/{Id(order)}/loyalty"));
        loyalty.GetProperty("maxRedeemable").GetDecimal().Should().Be(3000m, "10 % of the branch price, not of the base 45000");
        var tooMuch = await RedeemAsync(owner, Id(order), 4000m);
        tooMuch.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(tooMuch)).Should().Be("loyalty.exceeds_limit");

        (await RedeemAsync(owner, Id(order), 3000m)).StatusCode.Should().Be(HttpStatusCode.OK);
        await PayRemainingAsync(owner, Id(order));
        (await PointsAsync(owner, customerId)).Should().Be(4500m - 3000m + 2700m);
        var history = await ReadJsonAsync(await owner.GetAsync($"/api/v1/customers/{customerId}/orders"));
        history.GetProperty("items").EnumerateArray().Select(o => o.GetProperty("branchId").GetGuid())
            .Should().BeEquivalentTo([org.BranchId, branch2]);
    }

    private static async Task<JsonElement> SplitAsync(HttpClient client, Guid orderId, object body)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/orders/{orderId}/split", body, Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        return await ReadJsonAsync(response);
    }

    private static Task<HttpResponseMessage> PayBillAsync(
        HttpClient client, Guid orderId, Guid? billId, decimal amount, decimal tipAmount = 0m, string method = "cash") =>
        PostWithKeyAsync(client, "/api/v1/payments", new { orderId, billId, method, amount, tipAmount });
}
