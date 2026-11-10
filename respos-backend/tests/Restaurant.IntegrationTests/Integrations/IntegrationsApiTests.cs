using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Integrations;

[Collection(ApiCollection.Name)]
public sealed class IntegrationsApiTests(ApiFactory factory) : ApiTestBase(factory)
{
    public const string BotToken = "123456789:AAFakeTokenForApiTests_abcdefghijWXYZ";

    /// <summary>Same bearer token / branch header on the host with fake providers.</summary>
    internal HttpClient OnFakeHost(HttpClient source)
    {
        var client = FakeProviderHost.Get(Factory).CreateClient();
        client.DefaultRequestHeaders.Authorization = source.DefaultRequestHeaders.Authorization;
        foreach (var header in source.DefaultRequestHeaders.Where(h => h.Key == "X-Branch-Id"))
        {
            client.DefaultRequestHeaders.Add(header.Key, header.Value);
        }

        return client;
    }

    internal static Task<HttpResponseMessage> PutTelegramAsync(HttpClient client, string? token = BotToken, string time = "21:00") =>
        client.PutAsJsonAsync("/api/v1/integrations/telegram", new
        {
            isEnabled = true,
            config = new { botToken = token, chatIds = new[] { "-1001", "-1002" }, dailySummaryTime = time, bigRefundThreshold = 1000m },
        }, Json);

    [Fact]
    public async Task Secrets_are_encrypted_at_rest_and_masked_in_responses_and_audit()
    {
        var org = await CreateOrgWithUserAsync();
        var client = await LoginAsAsync(org.User);

        var put = await PutTelegramAsync(client);
        put.StatusCode.Should().Be(HttpStatusCode.OK);
        var putText = await put.Content.ReadAsStringAsync();
        putText.Should().NotContain(BotToken).And.Contain("****WXYZ");

        var list = await client.GetAsync("/api/v1/integrations");
        var listText = await list.Content.ReadAsStringAsync();
        listText.Should().NotContain(BotToken);
        var items = System.Text.Json.JsonDocument.Parse(listText).RootElement;
        var telegram = items.EnumerateArray().Single(i => i.GetProperty("type").GetString() == "telegram");
        telegram.GetProperty("status").GetString().Should().Be("connected");
        telegram.GetProperty("config").GetProperty("botToken").GetString().Should().Be("****WXYZ");
        items.EnumerateArray().Single(i => i.GetProperty("type").GetString() == "smtp")
            .GetProperty("status").GetString().Should().Be("not_configured");

        // Re-saving the masked value keeps the secret.
        (await PutTelegramAsync(client, "****WXYZ")).StatusCode.Should().Be(HttpStatusCode.OK);

        await WithDbAsync(async (db, sp) =>
        {
            var setting = await db.IntegrationSettings.IgnoreQueryFilters().SingleAsync(s => s.OrganizationId == org.OrganizationId);
            setting.ProtectedConfig.Should().NotContain(BotToken).And.NotContain("chatIds");
            sp.GetRequiredService<ISecretProtector>().Unprotect(setting.ProtectedConfig!).Should().Contain(BotToken, "round trip via the DB key ring");
            var audits = await db.AuditLogs.IgnoreQueryFilters()
                .Where(a => a.OrganizationId == org.OrganizationId && a.Action == "integration.updated").ToListAsync();
            audits.Should().HaveCount(2);
            audits.Should().OnlyContain(a => !a.ChangesJson!.Contains(BotToken) && !a.ChangesJson.Contains("WXYZ"));
        });
    }

    [Fact]
    public async Task Invalid_config_and_unknown_type_are_rejected_and_permission_is_required()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = await LoginAsAsync(org.User);
        var invalid = await PutTelegramAsync(owner, token: null);
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadJsonAsync(invalid)).GetProperty("errors").TryGetProperty("config.botToken", out _).Should().BeTrue();
        (await owner.PutAsJsonAsync("/api/v1/integrations/whatsapp", new { isEnabled = false, config = new { } }, Json))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);

        var waiter = await LoginAsAsync(await AddUserAsync(org, SystemRoles.Waiter));
        (await waiter.GetAsync("/api/v1/integrations")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Send_test_records_success_and_failures_with_error_log()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = await LoginAsAsync(org.User);
        var fake = OnFakeHost(owner);
        (await fake.PostAsJsonAsync("/api/v1/integrations/telegram/test", new { }, Json)).StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        await PutTelegramAsync(owner);

        FakeProviderHost.Providers.Next = () => DeliveryResult.Success;
        var ok = await ReadJsonAsync(await fake.PostAsJsonAsync("/api/v1/integrations/telegram/test", new { }, Json));
        ok.GetProperty("success").GetBoolean().Should().BeTrue();
        ok.GetProperty("integration").GetProperty("status").GetString().Should().Be("connected");

        FakeProviderHost.Providers.Next = () => DeliveryResult.Fail("Telegram HTTP 400: chat not found");
        try
        {
            var failed = await ReadJsonAsync(await fake.PostAsJsonAsync("/api/v1/integrations/telegram/test", new { }, Json));
            failed.GetProperty("success").GetBoolean().Should().BeFalse();
            failed.GetProperty("error").GetString().Should().Contain("chat not found");
            failed.GetProperty("integration").GetProperty("status").GetString().Should().Be("error");
        }
        finally
        {
            FakeProviderHost.Providers.Next = () => DeliveryResult.Success;
        }

        var log = await ReadJsonAsync(await owner.GetAsync("/api/v1/integrations/outbound-messages?channel=telegram"));
        log.GetProperty("totalCount").GetInt32().Should().Be(4, "2 chats × 2 tests");
        log.GetProperty("items")[0].GetProperty("recipientMasked").GetString().Should().Be("***", "short chat ids are fully masked");
        var errors = await ReadJsonAsync(await owner.GetAsync("/api/v1/integrations/errors?platformScope=true"));
        errors.GetProperty("totalCount").GetInt32().Should().Be(2);
        errors.GetProperty("items").EnumerateArray().Should().OnlyContain(e => e.GetProperty("organizationName").ValueKind == System.Text.Json.JsonValueKind.Null);

        var platform = await LoginAsAsync(ApiFactory.PlatformAdminEmail);
        var all = await ReadJsonAsync(await platform.GetAsync($"/api/v1/platform/integration-errors?organizationId={org.OrganizationId}"));
        all.GetProperty("totalCount").GetInt32().Should().Be(2);
        all.GetProperty("items")[0].GetProperty("organizationName").GetString().Should().StartWith("Test Org");
        (await owner.GetAsync("/api/v1/platform/integration-errors")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Shift_closed_with_difference_is_queued_and_dispatched_with_retry()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        await PutTelegramAsync(owner);
        var shift = await ReadJsonAsync(await owner.PostAsJsonAsync("/api/v1/cash-shifts/open", new { openingAmount = 100m }, Json));
        (await owner.PostAsJsonAsync($"/api/v1/cash-shifts/{shift.GetProperty("id").GetGuid()}/close", new { actualCashAmount = 90m }, Json))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        await WithDbAsync(async (db, _) =>
        {
            var queued = await db.OutboundMessages.Where(m => m.OrganizationId == org.OrganizationId).ToListAsync();
            queued.Should().HaveCount(2).And.OnlyContain(m => m.Kind == "shift_difference" && m.Status == OutboundStatus.Pending);
            queued.Should().OnlyContain(m => !m.ProtectedPayload.Contains("недостача"), "payload is encrypted");
        });

        await RunDispatcherAsync(() => DeliveryResult.Fail("Telegram HTTP 429", retryable: true, TimeSpan.FromMinutes(2)));
        await WithDbAsync(async (db, _) =>
        {
            var rows = await db.OutboundMessages.Where(m => m.OrganizationId == org.OrganizationId).ToListAsync();
            rows.Should().OnlyContain(m => m.Status == OutboundStatus.Pending && m.Attempts == 1 && m.NextAttemptAt > DateTime.UtcNow.AddMinutes(1));
            (await db.IntegrationErrorLogs.CountAsync(e => e.OrganizationId == org.OrganizationId)).Should().Be(2);
        });

        Factory.Clock.Advance(TimeSpan.FromMinutes(3));
        try
        {
            await RunDispatcherAsync(() => DeliveryResult.Success);
        }
        finally
        {
            Factory.Clock.Reset();
        }

        await WithDbAsync(async (db, _) =>
        {
            var rows = await db.OutboundMessages.Where(m => m.OrganizationId == org.OrganizationId).ToListAsync();
            rows.Should().OnlyContain(m => m.Status == OutboundStatus.Sent && m.Attempts == 2 && m.ProtectedPayload == string.Empty);
        });
        FakeProviderHost.Providers.Deliveries.Should().Contain(d => d.Text.Contains("недостача") && d.Text.Contains("10 UZS"));
    }

    private async Task RunDispatcherAsync(Func<DeliveryResult> next)
    {
        FakeProviderHost.Providers.Next = next;
        try
        {
            await using var scope = FakeProviderHost.Get(Factory).Services.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<Application.Features.Integrations.Outbound.OutboundDispatcher>().RunOnceAsync(500, default);
        }
        finally
        {
            FakeProviderHost.Providers.Next = () => DeliveryResult.Success;
        }
    }
}
