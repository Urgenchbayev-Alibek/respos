using System.Net;
using System.Net.Http.Json;
using Restaurant.Domain.Constants;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Staff;

/// <summary>F6 schedule CRUD, overlap rule, "my schedule", timesheet planned vs actual + CSV.</summary>
[Collection(ApiCollection.Name)]
public sealed class ScheduleTests(ApiFactory factory) : ApiTestBase(factory)
{
    private const string Base = "/api/v1/staff";

    [Fact]
    public async Task Schedule_crud_overlap_and_my_schedule()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        var manager = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var waiter = ClientWithBranch(await LoginAsAsync(waiterUser), org.BranchId);

        var create = await manager.PostAsJsonAsync($"{Base}/schedule",
            new { userId = waiterUser.Id, date = "2026-11-16", startTime = "18:00", endTime = "02:00", roleNote = "bar" }, Json);
        create.StatusCode.Should().Be(HttpStatusCode.Created);
        var shift = await ReadJsonAsync(create);
        shift.GetProperty("plannedMinutes").GetInt32().Should().Be(480, "overnight shift");
        var id = shift.GetProperty("id").GetGuid();

        var overlapNextDay = await manager.PostAsJsonAsync($"{Base}/schedule",
            new { userId = waiterUser.Id, date = "2026-11-17", startTime = "01:00", endTime = "05:00" }, Json);
        overlapNextDay.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(overlapNextDay)).Should().Be("shift.overlap");

        var invalid = await manager.PostAsJsonAsync($"{Base}/schedule",
            new { userId = waiterUser.Id, date = "2026-11-18", startTime = "9:00am", endTime = "17:00" }, Json);
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        (await waiter.PostAsJsonAsync($"{Base}/schedule",
            new { userId = waiterUser.Id, date = "2026-11-18", startTime = "09:00", endTime = "17:00" }, Json))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var update = await manager.PutAsJsonAsync($"{Base}/schedule/{id}",
            new { userId = waiterUser.Id, date = "2026-11-16", startTime = "10:00", endTime = "18:30" }, Json);
        update.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(update)).GetProperty("plannedMinutes").GetInt32().Should().Be(510);

        var week = await ReadJsonAsync(await manager.GetAsync($"{Base}/schedule?from=2026-11-16&to=2026-11-22"));
        week.GetArrayLength().Should().Be(1);
        var mine = await ReadJsonAsync(await waiter.GetAsync($"{Base}/schedule/my?from=2026-11-16&to=2026-11-22"));
        mine.GetArrayLength().Should().Be(1);
        mine[0].GetProperty("startTime").GetString().Should().Be("10:00");

        (await manager.DeleteAsync($"{Base}/schedule/{id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await manager.DeleteAsync($"{Base}/schedule/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Shift_for_user_of_another_organization_is_rejected()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var other = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var manager = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var response = await manager.PostAsJsonAsync($"{Base}/schedule",
            new { userId = other.User.Id, date = "2026-11-16", startTime = "09:00", endTime = "17:00" }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(response)).Should().Be("staff.member_not_found");
    }

    [Fact]
    public async Task Timesheet_shows_planned_vs_worked_and_exports_csv()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        var manager = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var day = DateTime.UtcNow.Date.AddDays(-3);
        var localDate = DateOnly.FromDateTime(day).ToString("yyyy-MM-dd");

        (await manager.PostAsJsonAsync($"{Base}/schedule",
            new { userId = waiterUser.Id, date = localDate, startTime = "09:00", endTime = "17:00" }, Json))
            .StatusCode.Should().Be(HttpStatusCode.Created);
        // 09:00–16:30 Tashkent (UTC+5) = 04:00–11:30 UTC, 30 min break → 420 worked minutes.
        (await manager.PostAsJsonAsync($"{Base}/time-entries", new
        {
            userId = waiterUser.Id, clockInAt = day.AddHours(4), clockOutAt = day.AddHours(11.5), breakMinutes = 30, reason = "import",
        }, Json)).StatusCode.Should().Be(HttpStatusCode.Created);

        var sheet = await ReadJsonAsync(await manager.GetAsync($"{Base}/timesheet?from={localDate}&to={localDate}"));
        var row = sheet.GetProperty("rows").EnumerateArray().Single();
        row.GetProperty("userId").GetGuid().Should().Be(waiterUser.Id);
        row.GetProperty("plannedMinutes").GetInt32().Should().Be(480);
        row.GetProperty("workedMinutes").GetInt32().Should().Be(420);
        row.GetProperty("days")[0].GetProperty("date").GetString().Should().Be(localDate);

        var csv = await manager.GetAsync($"{Base}/timesheet/export?from={localDate}&to={localDate}");
        csv.StatusCode.Should().Be(HttpStatusCode.OK);
        csv.Content.Headers.ContentType!.MediaType.Should().Be("text/csv");
        var text = await csv.Content.ReadAsStringAsync();
        text.Should().Contain("employee,date,planned_hours,worked_hours,difference_hours")
            .And.Contain($"Test User,{localDate},8.00,7.00,-1.00").And.Contain("Test User,total,8.00,7.00,-1.00");

        var waiter = ClientWithBranch(await LoginAsAsync(waiterUser), org.BranchId);
        (await waiter.GetAsync($"{Base}/timesheet")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
