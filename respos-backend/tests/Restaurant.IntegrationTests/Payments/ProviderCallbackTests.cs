using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Payments;

[Collection(ApiCollection.Name)]
public sealed class ProviderCallbackTests(ApiFactory factory) : F2TestBase(factory)
{
    [Fact]
    public async Task Payme_rejects_wrong_or_missing_basic_auth()
    {
        var wrong = await PaymeAsync("CheckTransaction", new { id = "x" }, key: "not-the-key");
        var missing = await PaymeAsync("CheckTransaction", new { id = "x" }, key: null);

        PaymeError(wrong).Should().Be(-32504);
        PaymeError(missing).Should().Be(-32504);
    }

    [Fact]
    public async Task Payme_full_flow_pays_the_order_once_and_is_idempotent()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        var orderId = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.PlovId)));

        var disabled = await client.PostAsJsonAsync("/api/v1/payments/intents", new { orderId, provider = "payme" }, Json);
        (await ReadErrorCodeAsync(disabled)).Should().Be("payment.provider_not_enabled");
        await EnableProviderAsync(client, "payme");
        var intent = await CreateIntentAsync(client, orderId, "payme", tipAmount: 5000m);
        var intentId = Id(intent);
        intent.GetProperty("status").GetString().Should().Be("pending");
        intent.GetProperty("paymentUrl").GetString().Should().StartWith("https://checkout.test.paycom.uz/");
        var manual = await PayAsync(client, orderId, 1000m);
        (await ReadErrorCodeAsync(manual)).Should().Be("payment.intent_pending");

        var account = new { order_id = intentId.ToString() };
        var total = Tiyin(PlovPrice + 5000m);
        PaymeError(await PaymeAsync("CheckPerformTransaction", new { amount = total - 100, account })).Should().Be(-31001);
        PaymeError(await PaymeAsync("CheckPerformTransaction", new { amount = total, account = new { order_id = Guid.NewGuid() } }))
            .Should().Be(-31050);
        (await PaymeAsync("CheckPerformTransaction", new { amount = total, account }))
            .GetProperty("result").GetProperty("allow").GetBoolean().Should().BeTrue();

        const string txId = "5305e3bab097f420a62ced0b";
        var time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var created = (await PaymeAsync("CreateTransaction", new { id = txId, time, amount = total, account })).GetProperty("result");
        created.GetProperty("state").GetInt32().Should().Be(1);
        created.GetProperty("transaction").GetString().Should().Be(intentId.ToString());
        var createdAgain = (await PaymeAsync("CreateTransaction", new { id = txId, time, amount = total, account })).GetProperty("result");
        createdAgain.GetProperty("create_time").GetInt64().Should().Be(created.GetProperty("create_time").GetInt64());
        PaymeError(await PaymeAsync("CreateTransaction", new { id = "other-tx", time, amount = total, account })).Should().Be(-31051);
        (await GetOrderAsync(client, orderId)).GetProperty("paidAmount").GetDecimal().Should().Be(0m, "pending until performed");

        var performed = (await PaymeAsync("PerformTransaction", new { id = txId })).GetProperty("result");
        var performedAgain = (await PaymeAsync("PerformTransaction", new { id = txId })).GetProperty("result");
        performed.GetProperty("state").GetInt32().Should().Be(2);
        performedAgain.GetProperty("perform_time").GetInt64().Should().Be(performed.GetProperty("perform_time").GetInt64());

        var order = await GetOrderAsync(client, orderId);
        order.GetProperty("status").GetString().Should().Be("paid");
        order.GetProperty("paidAmount").GetDecimal().Should().Be(PlovPrice);
        var payment = order.GetProperty("payments")[0];
        order.GetProperty("payments").GetArrayLength().Should().Be(1);
        payment.GetProperty("provider").GetString().Should().Be("payme");
        payment.GetProperty("tipAmount").GetDecimal().Should().Be(5000m);

        var check = (await PaymeAsync("CheckTransaction", new { id = txId })).GetProperty("result");
        check.GetProperty("state").GetInt32().Should().Be(2);
        PaymeError(await PaymeAsync("CancelTransaction", new { id = txId, reason = 5 })).Should().Be(-31007);
        PaymeError(await PaymeAsync("PerformTransaction", new { id = "unknown" })).Should().Be(-31003);
        var statement = (await PaymeAsync("GetStatement", new { from = time - 1000, to = time + 1000 })).GetProperty("result");
        statement.GetProperty("transactions").EnumerateArray().Should().Contain(t => t.GetProperty("id").GetString() == txId);
        (await ReadJsonAsync(await client.GetAsync($"/api/v1/payments/intents/{intentId}"))).GetProperty("status").GetString()
            .Should().Be("completed");
        await WithDbAsync(async (db, _) =>
        {
            (await db.Payments.IgnoreQueryFilters().CountAsync(p => p.OrderId == orderId)).Should().Be(1);
            (await db.AuditLogs.IgnoreQueryFilters().CountAsync(a => a.EntityId == intentId.ToString())).Should().BeGreaterThanOrEqualTo(3);
        });
    }

    [Fact]
    public async Task Payme_cancel_before_perform_cancels_the_intent_and_perform_is_refused()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        await EnableProviderAsync(client, "payme");
        var orderId = Id(await CreateOrderAsync(client, null, Line(seed.TeaId)));
        var intentId = Id(await CreateIntentAsync(client, orderId, "payme"));
        var txId = Guid.NewGuid().ToString("N")[..24];
        var account = new { order_id = intentId.ToString() };
        await PaymeAsync("CreateTransaction", new { id = txId, time = 1L, amount = Tiyin(TeaPrice), account });

        var cancelled = (await PaymeAsync("CancelTransaction", new { id = txId, reason = 3 })).GetProperty("result");

        cancelled.GetProperty("state").GetInt32().Should().Be(-1);
        PaymeError(await PaymeAsync("PerformTransaction", new { id = txId })).Should().Be(-31008);
        (await GetOrderAsync(client, orderId)).GetProperty("paidAmount").GetDecimal().Should().Be(0m);
        (await PayAsync(client, orderId, TeaPrice)).StatusCode.Should().Be(HttpStatusCode.Created, "a cancelled intent no longer blocks");
    }

    [Fact]
    public async Task Click_verifies_sign_and_prepare_complete_is_idempotent_per_bill()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        await EnableProviderAsync(client, "click");
        var orderId = Id(await CreateOrderAsync(client, seed.Table1Id, Line(seed.SaladId, 2m)));
        var bills = Bills(await SplitAsync(client, orderId, new { mode = "equal", parts = 2 }));
        var intentId = Id(await CreateIntentAsync(client, orderId, "click", billId: bills[0].Id));

        (await ClickAsync(0, "9001", intentId, "20000.00", secret: "wrong")).GetProperty("error").GetInt32().Should().Be(-1);
        (await ClickAsync(0, "9001", intentId, "19000.00")).GetProperty("error").GetInt32().Should().Be(-2);
        (await ClickAsync(0, "9001", Guid.NewGuid(), "20000.00")).GetProperty("error").GetInt32().Should().Be(-5);
        var prepare = await ClickAsync(0, "9001", intentId, "20000.00");
        prepare.GetProperty("error").GetInt32().Should().Be(0);
        var prepareId = prepare.GetProperty("merchant_prepare_id").GetInt64().ToString();
        (await ClickAsync(0, "9001", intentId, "20000.00")).GetProperty("merchant_prepare_id").GetInt64().ToString().Should().Be(prepareId);

        (await ClickAsync(1, "9001", intentId, "20000.00", prepareId: "1")).GetProperty("error").GetInt32().Should().Be(-6);
        var complete = await ClickAsync(1, "9001", intentId, "20000.00", prepareId: prepareId);
        var replay = await ClickAsync(1, "9001", intentId, "20000.00", prepareId: prepareId);

        complete.GetProperty("error").GetInt32().Should().Be(0);
        replay.GetProperty("error").GetInt32().Should().Be(0);
        replay.GetProperty("merchant_confirm_id").GetInt64().ToString().Should().Be(prepareId);
        var order = await GetOrderAsync(client, orderId);
        order.GetProperty("paidAmount").GetDecimal().Should().Be(20000m);
        order.GetProperty("status").GetString().Should().NotBe("paid");
        order.GetProperty("bills")[0].GetProperty("status").GetString().Should().Be("paid");
        await WithDbAsync(async (db, _) =>
        {
            var payment = await db.Payments.IgnoreQueryFilters().SingleAsync(p => p.OrderId == orderId);
            payment.Provider.Should().Be("click");
            payment.BillId.Should().Be(bills[0].Id);
            payment.Method.Should().Be(PaymentMethod.Other);
        });
    }

    [Fact]
    public async Task Click_complete_with_provider_error_cancels_the_intent()
    {
        var org = await CreateOrgWithUserAsync();
        var seed = await SeedPosAsync(org);
        var client = await BranchClientAsync(org);
        await OpenShiftAsync(client);
        await EnableProviderAsync(client, "click");
        var orderId = Id(await CreateOrderAsync(client, null, Line(seed.TeaId)));
        var intentId = Id(await CreateIntentAsync(client, orderId, "click"));
        var prepareId = (await ClickAsync(0, "777", intentId, "8000")).GetProperty("merchant_prepare_id").GetInt64().ToString();

        var failed = await ClickAsync(1, "777", intentId, "8000", prepareId: prepareId, error: -5017);

        failed.GetProperty("error").GetInt32().Should().Be(-9);
        (await ReadJsonAsync(await client.GetAsync($"/api/v1/payments/intents/{intentId}"))).GetProperty("status").GetString()
            .Should().Be("cancelled");
        (await GetOrderAsync(client, orderId)).GetProperty("paidAmount").GetDecimal().Should().Be(0m);
    }

    [Fact]
    public async Task Provider_list_reports_status_and_uzum_skeleton_cannot_be_enabled()
    {
        var org = await CreateOrgWithUserAsync();
        var client = await BranchClientAsync(org);

        var providers = await ReadJsonAsync(await client.GetAsync("/api/v1/payments/providers"));
        var uzum = await client.PutAsJsonAsync("/api/v1/payments/providers/uzum", new { isEnabled = true }, Json);
        var unknownCallback = await CreateClient().PostAsync("/api/v1/payments/providers/uzum/callback", new StringContent("{}"));
        var fiscal = await ReadJsonAsync(await client.GetAsync("/api/v1/payments/fiscal"));

        var byCode = providers.EnumerateArray().ToDictionary(p => p.GetProperty("code").GetString()!);
        byCode["payme"].GetProperty("status").GetString().Should().Be("test");
        byCode["payme"].GetProperty("isAvailable").GetBoolean().Should().BeFalse("not enabled for the branch yet");
        byCode["uzum"].GetProperty("status").GetString().Should().Be("not_connected");
        byCode["uzum"].GetProperty("isImplemented").GetBoolean().Should().BeFalse();
        uzum.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(uzum)).Should().Be("payment.provider_not_configured");
        unknownCallback.StatusCode.Should().Be(HttpStatusCode.NotFound);
        fiscal.GetProperty("code").GetString().Should().Be("none");
        fiscal.GetProperty("status").GetString().Should().Be("not_connected");
    }
}
