using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Restaurant.Domain.Constants;
using Restaurant.IntegrationTests.Floor;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Reservations;

[Collection(ApiCollection.Name)]
public sealed class ReservationTests(ApiFactory factory) : ApiTestBase(factory)
{
    private static readonly DateTime Base = DateTime.UtcNow.Date.AddDays(3).AddHours(12);

    private async Task<(TestOrg Org, HttpClient Client, Guid TableId)> SetupAsync(string role = SystemRoles.Owner)
    {
        var org = await CreateOrgWithUserAsync();
        var owner = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var tableId = await FloorApi.CreateTableAsync(owner, await FloorApi.CreateAreaAsync(owner), "1");
        if (role == SystemRoles.Owner)
        {
            return (org, owner, tableId);
        }

        var user = await AddUserAsync(org, role);
        return (org, ClientWithBranch(await LoginAsAsync(user), org.BranchId), tableId);
    }

    private static async Task<string?> StatusAsync(HttpClient client, Guid id, string action)
    {
        var response = await client.PostAsync($"/api/v1/reservations/{id}/{action}", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK, $"{action} should succeed");
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("status").GetString();
    }

    [Fact]
    public async Task Overlapping_active_reservation_on_same_table_is_a_conflict()
    {
        var (_, client, tableId) = await SetupAsync(SystemRoles.Waiter);
        var created = await FloorApi.PostReservationAsync(client, tableId, Base, Base.AddHours(2));
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await ReadJsonAsync(created);
        body.GetProperty("status").GetString().Should().Be("pending");
        body.GetProperty("tableNumber").GetString().Should().Be("1");

        var overlap = await FloorApi.PostReservationAsync(client, tableId, Base.AddHours(1), Base.AddHours(3));
        overlap.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(overlap)).Should().Be("reservation.time_conflict");

        var adjacent = await FloorApi.PostReservationAsync(client, tableId, Base.AddHours(2), Base.AddHours(3));
        adjacent.StatusCode.Should().Be(HttpStatusCode.Created);

        var noTable = await FloorApi.PostReservationAsync(client, null, Base, Base.AddHours(2));
        noTable.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Cancelled_reservation_frees_the_slot_and_update_checks_overlap()
    {
        var (_, client, tableId) = await SetupAsync();
        var first = await FloorApi.CreateReservationAsync(client, tableId, Base, Base.AddHours(2));
        var cancel = await client.PostAsJsonAsync($"/api/v1/reservations/{first}/cancel", new { reason = "передумали" }, Json);
        (await ReadJsonAsync(cancel)).GetProperty("cancelReason").GetString().Should().Be("передумали");

        var second = await FloorApi.CreateReservationAsync(client, tableId, Base, Base.AddHours(2));
        var third = await FloorApi.CreateReservationAsync(client, tableId, Base.AddHours(3), Base.AddHours(4));

        var move = await client.PutAsJsonAsync($"/api/v1/reservations/{third}", new
        {
            tableId, guestName = "Алишер", guestPhone = "+998901112233", guestCount = 3,
            startsAt = Base.AddHours(1), endsAt = Base.AddHours(4), comment = (string?)null,
        }, Json);
        move.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(move)).Should().Be("reservation.time_conflict");

        var selfUpdate = await client.PutAsJsonAsync($"/api/v1/reservations/{second}", new
        {
            tableId, guestName = "Алишер", guestPhone = "+998901112233", guestCount = 5,
            startsAt = Base, endsAt = Base.AddHours(2).AddMinutes(30), comment = "ДР",
        }, Json);
        selfUpdate.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(selfUpdate)).GetProperty("guestCount").GetInt32().Should().Be(5);
    }

    [Fact]
    public async Task Invalid_period_and_transitions_are_rejected()
    {
        var (_, client, tableId) = await SetupAsync();
        var badPeriod = await FloorApi.PostReservationAsync(client, tableId, Base, Base);
        badPeriod.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadErrorCodeAsync(badPeriod)).Should().Be("reservation.invalid_period");

        var id = await FloorApi.CreateReservationAsync(client, tableId, Base, Base.AddHours(1));
        foreach (var action in new[] { "complete", "seat" })
        {
            var response = await client.PostAsync($"/api/v1/reservations/{id}/{action}", null);
            response.StatusCode.Should().Be(HttpStatusCode.Conflict);
            (await ReadErrorCodeAsync(response)).Should().Be("reservation.invalid_status_transition");
        }

        (await StatusAsync(client, id, "no-show")).Should().Be("no_show");
        var again = await client.PostAsync($"/api/v1/reservations/{id}/confirm", null);
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Seat_occupies_table_and_complete_frees_it()
    {
        var (_, client, tableId) = await SetupAsync(SystemRoles.Waiter);
        var id = await FloorApi.CreateReservationAsync(client, tableId, DateTime.UtcNow.AddMinutes(-5), DateTime.UtcNow.AddHours(1));

        (await StatusAsync(client, id, "confirm")).Should().Be("confirmed");
        (await FloorApi.GetTableAsync(client, tableId)).GetProperty("status").GetString().Should().Be("available");

        (await StatusAsync(client, id, "seat")).Should().Be("seated");
        (await FloorApi.GetTableAsync(client, tableId)).GetProperty("status").GetString().Should().Be("occupied");

        var cancelSeated = await client.PostAsync($"/api/v1/reservations/{id}/cancel", null);
        cancelSeated.StatusCode.Should().Be(HttpStatusCode.Conflict);

        (await StatusAsync(client, id, "complete")).Should().Be("completed");
        (await FloorApi.GetTableAsync(client, tableId)).GetProperty("status").GetString().Should().Be("available");
    }

    [Fact]
    public async Task Complete_keeps_table_occupied_while_an_order_is_active()
    {
        var (org, client, tableId) = await SetupAsync();
        var id = await FloorApi.CreateReservationAsync(client, tableId, DateTime.UtcNow.AddMinutes(-5), DateTime.UtcNow.AddHours(1));
        await StatusAsync(client, id, "confirm");
        await StatusAsync(client, id, "seat");
        await WithDbAsync(async (db, _) => await FloorApi.AddOpenOrderAsync(db, org, tableId));

        await StatusAsync(client, id, "complete");

        (await FloorApi.GetTableAsync(client, tableId)).GetProperty("status").GetString().Should().Be("occupied");
    }

    [Fact]
    public async Task Seating_on_unavailable_table_is_refused()
    {
        var (_, client, tableId) = await SetupAsync();
        var id = await FloorApi.CreateReservationAsync(client, tableId, Base, Base.AddHours(1));
        await StatusAsync(client, id, "confirm");
        await client.PostAsJsonAsync($"/api/v1/tables/{tableId}/status", new { status = "unavailable" }, Json);

        var seat = await client.PostAsync($"/api/v1/reservations/{id}/seat", null);

        seat.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(seat)).Should().Be("table.unavailable");
    }

    [Fact]
    public async Task List_filters_by_date_status_and_search()
    {
        var (_, client, tableId) = await SetupAsync();
        await FloorApi.CreateReservationAsync(client, tableId, Base, Base.AddHours(1));
        var otherDay = await FloorApi.PostReservationAsync(client, tableId, Base.AddDays(2), Base.AddDays(2).AddHours(1), "Bobur");
        otherDay.EnsureSuccessStatusCode();

        var date = DateOnly.FromDateTime(Base.AddHours(5)).ToString("yyyy-MM-dd");
        var byDate = await client.GetFromJsonAsync<JsonElement>($"/api/v1/reservations?date={date}", Json);
        byDate.GetProperty("totalCount").GetInt32().Should().Be(1);

        var bySearch = await client.GetFromJsonAsync<JsonElement>("/api/v1/reservations?search=BOB&status=pending", Json);
        bySearch.GetProperty("items").EnumerateArray().Single().GetProperty("guestName").GetString().Should().Be("Bobur");
    }

    [Fact]
    public async Task Cook_cannot_read_reservations_and_other_tenant_ids_are_404()
    {
        var (org, owner, tableId) = await SetupAsync();
        var id = await FloorApi.CreateReservationAsync(owner, tableId, Base, Base.AddHours(1));
        var cook = ClientWithBranch(await LoginAsAsync(await AddUserAsync(org, SystemRoles.Cook)), org.BranchId);
        (await cook.GetAsync("/api/v1/reservations")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var (_, stranger, _) = await SetupAsync();
        var foreign = await stranger.PostAsync($"/api/v1/reservations/{id}/confirm", null);
        foreign.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var foreignTable = await FloorApi.PostReservationAsync(stranger, tableId, Base, Base.AddHours(1));
        foreignTable.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
