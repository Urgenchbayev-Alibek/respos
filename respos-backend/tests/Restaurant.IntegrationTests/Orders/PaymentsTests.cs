using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Orders;

[Collection(ApiCollection.Name)]
public sealed class PaymentsTests(ApiFactory factory) : PosTestBase(factory)
{
    [Fact]
    public async Task Payment_requires_an_open_shift_and_only_one_shift_can_be_open()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Cashier);
        var seed = await SeedPosAsync(org);
        var cashier = await BranchClientAsync(org);
        var owner = await BranchClientAsync(org, await AddUserAsync(org, SystemRoles.Owner));
        var orderId = Id(await CreateOrderAsync(owner, null, Line(seed.TeaId)));

        (await cashier.GetAsync("/api/v1/cash-shifts/current")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var noShift = await PayAsync(cashier, orderId, TeaPrice);
        noShift.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(noShift)).Should().Be("cash_shift.not_open");

        await OpenShiftAsync(cashier, 50000m);
        var second = await cashier.PostAsJsonAsync("/api/v1/cash-shifts/open", new { openingAmount = 0 });
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(second)).Should().Be("cash_shift.already_open");
        (await cashier.GetAsync("/api/v1/cash-shifts/current")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Same_idempotency_key_creates_one_payment_and_overpay_is_rejected()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        var orderId = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.PlovId)));
        var key = Guid.NewGuid().ToString();

        var first = await PayAsync(client, orderId, 10000m, key: key);
        var replay = await PayAsync(client, orderId, 10000m, key: key);
        var overpay = await PayAsync(client, orderId, PlovPrice);
        var zero = await PayAsync(client, orderId, 0m);

        first.StatusCode.Should().Be(HttpStatusCode.Created, await first.Content.ReadAsStringAsync());
        replay.StatusCode.Should().Be(HttpStatusCode.Created);
        replay.Headers.GetValues("Idempotent-Replayed").Should().Equal("true");
        Id(await ReadJsonAsync(replay)).Should().Be(Id(await ReadJsonAsync(first)));
        overpay.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(overpay)).Should().Be("payment.exceeds_due");
        zero.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        await WithDbAsync(async (db, _) =>
            (await db.Payments.IgnoreQueryFilters().CountAsync(p => p.OrderId == orderId)).Should().Be(1));
        var order = await GetOrderAsync(client, orderId);
        order.GetProperty("paidAmount").GetDecimal().Should().Be(10000m);
        order.GetProperty("remainingAmount").GetDecimal().Should().Be(PlovPrice - 10000m);
        order.GetProperty("payments").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task Full_payment_closes_the_order_frees_the_table_and_blocks_more_payments()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        var orderId = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.PlovId)));

        (await PayAsync(client, orderId, 20000m, "card")).EnsureSuccessStatusCode();
        (await PayAsync(client, orderId, PlovPrice - 20000m)).EnsureSuccessStatusCode();
        var again = await PayAsync(client, orderId, 1m);

        var order = await GetOrderAsync(client, orderId);
        order.GetProperty("status").GetString().Should().Be("paid");
        order.GetProperty("remainingAmount").GetDecimal().Should().Be(0m);
        order.GetProperty("closedAt").ValueKind.Should().NotBe(System.Text.Json.JsonValueKind.Null);
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
        await WithDbAsync(async (db, _) =>
            (await db.DiningTables.IgnoreQueryFilters().SingleAsync(t => t.Id == seed.Table1Id)).Status.Should().Be(TableStatus.Available));
        var receipt = await ReadJsonAsync(await client.GetAsync($"/api/v1/orders/{orderId}/receipt"));
        receipt.GetProperty("isFiscal").GetBoolean().Should().BeFalse();
        receipt.GetProperty("fiscalNotice").GetString().Should().Be("Не является фискальным чеком");
        receipt.GetProperty("payments").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task Shift_close_uses_cash_payments_minus_cash_refunds_and_reports_totals_by_method()
    {
        var org = await CreateOrgWithUserAsync();
        var cashierUser = await AddUserAsync(org, SystemRoles.Cashier);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        var cashier = await BranchClientAsync(org, cashierUser);
        var shift = await OpenShiftAsync(cashier, 100000m);
        var orderId = Id(await CreateOrderAsync(client, null, Line(seed.PlovId)));
        var cash = await ReadJsonAsync(await PayAsync(cashier, orderId, 30000m));
        (await PayAsync(cashier, orderId, 15000m, "card")).EnsureSuccessStatusCode();

        var forbidden = await PostWithKeyAsync(await BranchClientAsync(org, waiterUser), $"/api/v1/payments/{Id(cash)}/refunds", new { amount = 1, reason = "x" });
        var tooMuch = await PostWithKeyAsync(cashier, $"/api/v1/payments/{Id(cash)}/refunds", new { amount = 30000.01m, reason = "ошибка" });
        var refund = await PostWithKeyAsync(cashier, $"/api/v1/payments/{Id(cash)}/refunds", new { amount = 5000m, reason = "остывшее блюдо" });

        forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        tooMuch.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(tooMuch)).Should().Be("payment.invalid_refund_amount");
        refund.StatusCode.Should().Be(HttpStatusCode.Created, await refund.Content.ReadAsStringAsync());
        var refundBody = await ReadJsonAsync(refund);
        refundBody.GetProperty("method").GetString().Should().Be("cash");
        refundBody.GetProperty("payment").GetProperty("status").GetString().Should().Be("partially_refunded");
        (await GetOrderAsync(client, orderId)).GetProperty("status").GetString().Should().Be("paid");

        var close = await cashier.PostAsJsonAsync($"/api/v1/cash-shifts/{Id(shift)}/close", new { actualCashAmount = 124000m, comment = "недостача" });
        close.StatusCode.Should().Be(HttpStatusCode.OK, await close.Content.ReadAsStringAsync());
        var closed = await ReadJsonAsync(close);
        closed.GetProperty("status").GetString().Should().Be("closed");
        closed.GetProperty("expectedCashAmount").GetDecimal().Should().Be(125000m);
        closed.GetProperty("difference").GetDecimal().Should().Be(-1000m);
        var totals = closed.GetProperty("totalsByMethod").EnumerateArray()
            .ToDictionary(t => t.GetProperty("method").GetString()!, t => t.GetProperty("amount").GetDecimal());
        totals["cash"].Should().Be(25000m);
        totals["card"].Should().Be(15000m);
        (await cashier.PostAsJsonAsync($"/api/v1/cash-shifts/{Id(shift)}/close", new { actualCashAmount = 1 }))
            .StatusCode.Should().Be(HttpStatusCode.Conflict);
        var list = await ReadJsonAsync(await cashier.GetAsync($"/api/v1/payments?shiftId={Id(shift)}"));
        list.GetProperty("totalCount").GetInt32().Should().Be(2);
        await WithDbAsync(async (db, _) =>
            (await db.AuditLogs.IgnoreQueryFilters().AnyAsync(a => a.Action == "payment.refunded" && a.EntityId == Id(cash).ToString()))
            .Should().BeTrue());
    }
}
