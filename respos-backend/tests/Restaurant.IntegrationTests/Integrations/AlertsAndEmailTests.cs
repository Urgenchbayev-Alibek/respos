using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Features.Integrations.Alerts;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Floor;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Integrations;

[Collection(ApiCollection.Name)]
public sealed class AlertsAndEmailTests(ApiFactory factory) : ApiTestBase(factory)
{
    [Fact]
    public async Task Daily_summary_is_queued_once_per_branch_and_day()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = await LoginAsAsync(org.User);
        (await IntegrationsApiTests.PutTelegramAsync(owner, time: "00:00")).StatusCode.Should().Be(HttpStatusCode.OK);

        await RunDailySummaryAsync();
        await RunDailySummaryAsync();

        await WithDbAsync(async (db, _) =>
        {
            var rows = await db.OutboundMessages.Where(m => m.OrganizationId == org.OrganizationId && m.Kind == AlertKinds.DailySummary).ToListAsync();
            rows.Should().HaveCount(2, "one per chat id, not repeated by the second run");
            rows.Should().OnlyContain(m => m.DedupeKey!.StartsWith(org.OrganizationId.ToString("N")) && m.BranchId == org.BranchId);
            rows.Select(m => m.DedupeKey).Distinct().Should().HaveCount(2);
        });
    }

    [Fact]
    public async Task Daily_summary_waits_for_the_configured_branch_local_time_and_skips_disabled()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = await LoginAsAsync(org.User);
        var tashkentNow = TimeZoneInfo.ConvertTimeFromUtc(Factory.Clock.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Tashkent"));
        var later = tashkentNow.AddHours(1);
        if (later.Date != tashkentNow.Date)
        {
            return; // close to local midnight: "later today" does not exist
        }

        await IntegrationsApiTests.PutTelegramAsync(owner, time: later.ToString("HH:mm"));
        await RunDailySummaryAsync();
        await WithDbAsync(async (db, _) =>
            (await db.OutboundMessages.CountAsync(m => m.OrganizationId == org.OrganizationId)).Should().Be(0));
    }

    [Fact]
    public async Task Invitation_email_is_queued_when_org_smtp_is_enabled_otherwise_log_only()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = await LoginAsAsync(org.User);
        await InviteAsync(owner, org);
        await WithDbAsync(async (db, _) =>
            (await db.OutboundMessages.CountAsync(m => m.OrganizationId == org.OrganizationId)).Should().Be(0, "no SMTP → log stub"));

        var smtp = await owner.PutAsJsonAsync("/api/v1/integrations/smtp", new
        {
            isEnabled = true,
            config = new { host = "smtp.example.uz", port = 587, username = "u", password = "SmtpSecret123", fromEmail = "noreply@example.uz" },
        }, Json);
        smtp.StatusCode.Should().Be(HttpStatusCode.OK);
        (await smtp.Content.ReadAsStringAsync()).Should().NotContain("SmtpSecret123");

        var email = await InviteAsync(owner, org);
        await WithDbAsync(async (db, _) =>
        {
            var row = await db.OutboundMessages.SingleAsync(m => m.OrganizationId == org.OrganizationId);
            row.Channel.Should().Be(OutboundChannel.Email);
            row.RecipientMasked.Should().Be(email[0] + "***@test.respos.uz");
            row.Summary.Should().Contain("Приглашение").And.Contain("taklif");
            row.ProtectedPayload.Should().NotContain("accept-invitation");
        });
    }

    [Fact]
    public async Task Confirming_a_reservation_queues_a_guest_sms_when_eskiz_is_enabled()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var tableId = await FloorApi.CreateTableAsync(owner, await FloorApi.CreateAreaAsync(owner), "7");
        var start = DateTime.UtcNow.Date.AddDays(4).AddHours(14);
        var first = await FloorApi.CreateReservationAsync(owner, tableId, start, start.AddHours(2));
        (await owner.PostAsync($"/api/v1/reservations/{first}/confirm", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await owner.PutAsJsonAsync("/api/v1/integrations/sms_eskiz", new
        {
            isEnabled = true,
            config = new { email = "sms@example.uz", password = "EskizPass123", from = "4546", reservationConfirmationEnabled = true },
        }, Json)).StatusCode.Should().Be(HttpStatusCode.OK);
        var second = await FloorApi.CreateReservationAsync(owner, tableId, start.AddHours(3), start.AddHours(5));
        (await owner.PostAsync($"/api/v1/reservations/{second}/confirm", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        await WithDbAsync(async (db, _) =>
        {
            var rows = await db.OutboundMessages.Where(m => m.OrganizationId == org.OrganizationId).ToListAsync();
            rows.Should().ContainSingle("SMS disabled at the first confirmation → no-op")
                .Which.Should().Match<Domain.Entities.Integrations.OutboundMessage>(m => m.Channel == OutboundChannel.Sms && m.Kind == AlertKinds.ReservationConfirmed);
        });
    }

    private async Task<string> InviteAsync(HttpClient owner, TestOrg org)
    {
        var email = $"invitee-{Guid.NewGuid():N}"[..20] + "@test.respos.uz";
        var response = await owner.PostAsJsonAsync("/api/v1/users/invitations", new
        {
            email, fullName = "Invited Person", roleIds = new[] { org.RoleIds[SystemRoles.Waiter] }, branchIds = new[] { org.BranchId },
        }, Json);
        response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.Created);
        return email;
    }

    private async Task RunDailySummaryAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DailySummaryJob>().RunAsync(default);
    }
}
