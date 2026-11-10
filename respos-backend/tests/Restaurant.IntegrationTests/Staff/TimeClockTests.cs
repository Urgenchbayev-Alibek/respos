using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Staff;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Staff;

/// <summary>F6 time clock: one open entry, duration, audited corrections, permissions, branch/tenant isolation.</summary>
[Collection(ApiCollection.Name)]
public sealed class TimeClockTests(ApiFactory factory) : ApiTestBase(factory)
{
    private const string Base = "/api/v1/staff";

    [Fact]
    public async Task Only_one_open_entry_per_user()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var waiter = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var first = await waiter.PostAsJsonAsync($"{Base}/time-clock/clock-in", new { note = "start" }, Json);
        first.StatusCode.Should().Be(HttpStatusCode.Created);
        var second = await waiter.PostAsJsonAsync($"{Base}/time-clock/clock-in", new { }, Json);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(second)).Should().Be("time_entry.already_open");

        var me = await ReadJsonAsync(await waiter.GetAsync($"{Base}/time-clock/me"));
        me.GetProperty("openEntry").GetProperty("isOpen").GetBoolean().Should().BeTrue();
        me.GetProperty("openEntry").GetProperty("note").GetString().Should().Be("start");
    }

    [Fact]
    public async Task Clock_out_computes_worked_minutes_minus_break()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Cook);
        var cook = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        (await cook.PostAsJsonAsync($"{Base}/time-clock/clock-out", new { }, Json)).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await cook.PostAsJsonAsync($"{Base}/time-clock/clock-in", new { }, Json)).StatusCode.Should().Be(HttpStatusCode.Created);

        Factory.Clock.Advance(TimeSpan.FromMinutes(95));
        try
        {
            var response = await cook.PostAsJsonAsync($"{Base}/time-clock/clock-out", new { breakMinutes = 15 }, Json);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var entry = await ReadJsonAsync(response);
            entry.GetProperty("isOpen").GetBoolean().Should().BeFalse();
            entry.GetProperty("breakMinutes").GetInt32().Should().Be(15);
            entry.GetProperty("workedMinutes").GetInt32().Should().Be(80);
        }
        finally
        {
            Factory.Clock.Reset();
        }

        var me = await ReadJsonAsync(await cook.GetAsync($"{Base}/time-clock/me"));
        me.GetProperty("openEntry").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Null);
    }

    [Fact]
    public async Task Manager_corrects_entry_with_reason_and_it_is_audited()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        var waiter = ClientWithBranch(await LoginAsAsync(waiterUser), org.BranchId);
        var manager = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var created = await ReadJsonAsync(await waiter.PostAsJsonAsync($"{Base}/time-clock/clock-in", new { }, Json));
        var id = created.GetProperty("id").GetGuid();

        (await waiter.GetAsync($"{Base}/time-entries")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var clockIn = DateTime.UtcNow.AddHours(-3);
        var noReason = await manager.PutAsJsonAsync($"{Base}/time-entries/{id}",
            new { clockInAt = clockIn, clockOutAt = clockIn.AddHours(2), breakMinutes = 30, reason = "" }, Json);
        noReason.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var fixedResponse = await manager.PutAsJsonAsync($"{Base}/time-entries/{id}",
            new { clockInAt = clockIn, clockOutAt = clockIn.AddHours(2), breakMinutes = 30, reason = "forgot to clock out" }, Json);
        fixedResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var corrected = await ReadJsonAsync(fixedResponse);
        corrected.GetProperty("workedMinutes").GetInt32().Should().Be(90);
        corrected.GetProperty("editedBy").GetGuid().Should().Be(org.User.Id);
        corrected.GetProperty("editReason").GetString().Should().Be("forgot to clock out");

        var list = await ReadJsonAsync(await manager.GetAsync($"{Base}/time-entries?userId={waiterUser.Id}"));
        list.GetProperty("totalCount").GetInt32().Should().Be(1);

        await WithDbAsync(async (db, _) =>
        {
            var audit = await db.AuditLogs.SingleAsync(a => a.Action == "staff.time_entry_corrected" && a.EntityId == id.ToString());
            audit.UserId.Should().Be(org.User.Id);
            audit.ChangesJson.Should().Contain("forgot to clock out").And.Contain("before");
        });
    }

    [Fact]
    public async Task Manager_manual_entry_rejects_future_and_inverted_periods()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        var manager = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var start = DateTime.UtcNow.AddHours(-5);

        var inverted = await manager.PostAsJsonAsync($"{Base}/time-entries",
            new { userId = waiterUser.Id, clockInAt = start, clockOutAt = start.AddHours(-1), breakMinutes = 0, reason = "manual" }, Json);
        (await ReadErrorCodeAsync(inverted)).Should().Be("time_entry.invalid_period");

        var ok = await manager.PostAsJsonAsync($"{Base}/time-entries",
            new { userId = waiterUser.Id, clockInAt = start, clockOutAt = start.AddHours(4), breakMinutes = 60, reason = "manual" }, Json);
        ok.StatusCode.Should().Be(HttpStatusCode.Created);
        (await ReadJsonAsync(ok)).GetProperty("source").GetString().Should().Be("manager");
    }

    [Fact]
    public async Task Entries_are_isolated_by_branch_and_tenant()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var other = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var secondBranch = Guid.Empty;
        await WithDbAsync(async (db, _) =>
        {
            var branch = new RestaurantBranch { OrganizationId = org.OrganizationId, Name = "Second" };
            db.Branches.Add(branch);
            db.UserBranchAccesses.Add(new UserBranchAccess { OrganizationId = org.OrganizationId, UserId = org.User.Id, BranchId = branch.Id });
            await db.SaveChangesAsync();
            secondBranch = branch.Id;
        });
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        var waiter = ClientWithBranch(await LoginAsAsync(waiterUser), org.BranchId);
        var entryId = (await ReadJsonAsync(await waiter.PostAsJsonAsync($"{Base}/time-clock/clock-in", new { }, Json)))
            .GetProperty("id").GetGuid();

        var managerSecond = ClientWithBranch(await LoginAsAsync(org.User), secondBranch);
        (await ReadJsonAsync(await managerSecond.GetAsync($"{Base}/time-entries"))).GetProperty("totalCount").GetInt32().Should().Be(0);
        var update = new { clockInAt = DateTime.UtcNow.AddHours(-1), breakMinutes = 0, reason = "x" };
        (await managerSecond.PutAsJsonAsync($"{Base}/time-entries/{entryId}", update, Json)).StatusCode.Should().Be(HttpStatusCode.NotFound);

        var foreign = ClientWithBranch(await LoginAsAsync(other.User), other.BranchId);
        (await ReadJsonAsync(await foreign.GetAsync($"{Base}/time-entries"))).GetProperty("totalCount").GetInt32().Should().Be(0);
        (await foreign.PutAsJsonAsync($"{Base}/time-entries/{entryId}", update, Json)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        var foreignEntry = await foreign.PostAsJsonAsync($"{Base}/time-entries",
            new { userId = waiterUser.Id, clockInAt = DateTime.UtcNow.AddHours(-2), clockOutAt = DateTime.UtcNow.AddHours(-1), breakMinutes = 0, reason = "x" },
            Json);
        (await ReadErrorCodeAsync(foreignEntry)).Should().Be("staff.member_not_found");

        // Waiter of the main branch cannot use the second branch at all.
        var waiterSecond = ClientWithBranch(await LoginAsAsync(waiterUser), secondBranch);
        (await waiterSecond.GetAsync($"{Base}/time-clock/me")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        await WithDbAsync(async (db, _) =>
            (await db.TimeEntries.IgnoreQueryFilters().CountAsync(e => e.UserId == waiterUser.Id)).Should().Be(1));
    }
}
