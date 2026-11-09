using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Identity;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Floor;

[Collection(ApiCollection.Name)]
public sealed class FloorTests(ApiFactory factory) : ApiTestBase(factory)
{
    private async Task<(TestOrg Org, HttpClient Client)> OwnerAsync()
    {
        var org = await CreateOrgWithUserAsync();
        return (org, ClientWithBranch(await LoginAsAsync(org.User), org.BranchId));
    }

    [Fact]
    public async Task Owner_manages_areas_and_tables()
    {
        var (_, client) = await OwnerAsync();
        var areaId = await FloorApi.CreateAreaAsync(client, "Терраса");

        var created = await FloorApi.PostTableAsync(client, areaId, "12", 6);
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var table = await ReadJsonAsync(created);
        table.GetProperty("number").GetString().Should().Be("12");
        table.GetProperty("areaName").GetString().Should().Be("Терраса");
        table.GetProperty("status").GetString().Should().Be("available");
        table.GetProperty("activeOrderId").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Null);

        var tableId = table.GetProperty("id").GetGuid();
        var updated = await client.PutAsJsonAsync($"/api/v1/tables/{tableId}",
            new { number = "12A", capacity = 8, areaId, posX = 10.5m, posY = 20m }, Json);
        updated.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(updated)).GetProperty("capacity").GetInt32().Should().Be(8);

        var areas = await client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/v1/dining-areas", Json);
        areas.EnumerateArray().Single(a => a.GetProperty("id").GetGuid() == areaId).GetProperty("tableCount").GetInt32().Should().Be(1);

        var filtered = await client.GetFromJsonAsync<System.Text.Json.JsonElement>($"/api/v1/tables?areaId={areaId}&status=available", Json);
        filtered.GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task Table_number_is_unique_per_branch_among_non_archived()
    {
        var (_, client) = await OwnerAsync();
        var areaId = await FloorApi.CreateAreaAsync(client);
        var firstId = await FloorApi.CreateTableAsync(client, areaId, "5");

        var duplicate = await FloorApi.PostTableAsync(client, areaId, "5");
        duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(duplicate)).Should().Be("table.number_taken");

        (await client.DeleteAsync($"/api/v1/tables/{firstId}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await FloorApi.PostTableAsync(client, areaId, "5")).StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Archived_table_is_hidden_and_not_usable()
    {
        var (_, client) = await OwnerAsync();
        var areaId = await FloorApi.CreateAreaAsync(client);
        var tableId = await FloorApi.CreateTableAsync(client, areaId, "7");
        await client.DeleteAsync($"/api/v1/tables/{tableId}");

        var tables = await client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/v1/tables", Json);
        tables.EnumerateArray().Should().NotContain(t => t.GetProperty("id").GetGuid() == tableId);

        var status = await client.PostAsJsonAsync($"/api/v1/tables/{tableId}/status", new { status = "unavailable" }, Json);
        status.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(status)).Should().Be("table.archived");

        var reservation = await FloorApi.PostReservationAsync(client, tableId, DateTime.UtcNow.AddHours(1), DateTime.UtcNow.AddHours(2));
        reservation.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(reservation)).Should().Be("table.archived");
    }

    [Fact]
    public async Task Area_with_tables_cannot_be_archived()
    {
        var (_, client) = await OwnerAsync();
        var areaId = await FloorApi.CreateAreaAsync(client);
        var tableId = await FloorApi.CreateTableAsync(client, areaId, "1");

        var refused = await client.DeleteAsync($"/api/v1/dining-areas/{areaId}");
        refused.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(refused)).Should().Be("dining_area.has_tables");

        await client.DeleteAsync($"/api/v1/tables/{tableId}");
        (await client.DeleteAsync($"/api/v1/dining-areas/{areaId}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var areas = await client.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/v1/dining-areas", Json);
        areas.EnumerateArray().Should().NotContain(a => a.GetProperty("id").GetGuid() == areaId);
    }

    [Fact]
    public async Task Manual_status_only_available_or_unavailable()
    {
        var (_, client) = await OwnerAsync();
        var tableId = await FloorApi.CreateTableAsync(client, await FloorApi.CreateAreaAsync(client), "3");

        var occupied = await client.PostAsJsonAsync($"/api/v1/tables/{tableId}/status", new { status = "occupied" }, Json);
        occupied.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var off = await client.PostAsJsonAsync($"/api/v1/tables/{tableId}/status", new { status = "unavailable" }, Json);
        off.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(off)).GetProperty("status").GetString().Should().Be("unavailable");
    }

    [Fact]
    public async Task Table_dto_shows_active_order_and_next_reservation()
    {
        var (org, client) = await OwnerAsync();
        var tableId = await FloorApi.CreateTableAsync(client, await FloorApi.CreateAreaAsync(client), "9");
        var order = default(Domain.Entities.Orders.Order);
        await WithDbAsync(async (db, _) => order = await FloorApi.AddOpenOrderAsync(db, org, tableId));
        var start = DateTime.UtcNow.AddMinutes(1);
        var reservationId = await FloorApi.CreateReservationAsync(client, tableId, start, start.AddMinutes(1));
        await client.PostAsync($"/api/v1/reservations/{reservationId}/confirm", null);

        var table = await FloorApi.GetTableAsync(client, tableId);

        table.GetProperty("activeOrderId").GetGuid().Should().Be(order!.Id);
        table.GetProperty("activeOrderTotal").GetDecimal().Should().Be(50_000m);
        table.GetProperty("nextReservation").GetProperty("id").GetGuid().Should().Be(reservationId);
        table.GetProperty("nextReservation").GetProperty("guestName").GetString().Should().Be("Алишер");

        var manual = await client.PostAsJsonAsync($"/api/v1/tables/{tableId}/status", new { status = "unavailable" }, Json);
        manual.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(manual)).Should().Be("table.has_active_order");
        (await client.DeleteAsync($"/api/v1/tables/{tableId}")).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Waiter_reads_tables_but_cannot_manage_them()
    {
        var (org, owner) = await OwnerAsync();
        var areaId = await FloorApi.CreateAreaAsync(owner);
        var waiter = ClientWithBranch(await LoginAsAsync(await AddUserAsync(org, SystemRoles.Waiter)), org.BranchId);

        (await waiter.GetAsync("/api/v1/tables")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await FloorApi.PostTableAsync(waiter, areaId, "1")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await waiter.PostAsJsonAsync("/api/v1/dining-areas", new { name = "X" }, Json)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Tables_of_other_branches_and_tenants_are_not_reachable()
    {
        var (org, client) = await OwnerAsync();
        var (other, otherClient) = await OwnerAsync();
        var foreignTable = await FloorApi.CreateTableAsync(otherClient, await FloorApi.CreateAreaAsync(otherClient), "1");

        var secondBranchId = Guid.Empty;
        await WithDbAsync(async (db, _) =>
        {
            var branch = new RestaurantBranch { OrganizationId = org.OrganizationId, Name = "Second" };
            db.Branches.Add(branch);
            var area = new DiningArea { OrganizationId = org.OrganizationId, BranchId = branch.Id, Name = "B2" };
            db.DiningAreas.Add(area);
            db.DiningTables.Add(new DiningTable { OrganizationId = org.OrganizationId, BranchId = branch.Id, DiningAreaId = area.Id, Number = "1", Capacity = 2 });
            await db.SaveChangesAsync();
            secondBranchId = branch.Id;
        });
        var secondBranchTable = Guid.Empty;
        await WithDbAsync(async (db, _) => secondBranchTable = await db.DiningTables.IgnoreQueryFilters()
            .Where(t => t.BranchId == secondBranchId).Select(t => t.Id).SingleAsync());

        foreach (var id in new[] { foreignTable, secondBranchTable })
        {
            var response = await client.PostAsJsonAsync($"/api/v1/tables/{id}/status", new { status = "unavailable" }, Json);
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await ReadErrorCodeAsync(response)).Should().Be("table.not_found");
        }

        var otherOrgBranch = ClientWithBranch(await LoginAsAsync(org.User), other.BranchId);
        (await otherOrgBranch.GetAsync("/api/v1/tables")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var waiter = ClientWithBranch(await LoginAsAsync(await AddUserAsync(org, SystemRoles.Waiter)), secondBranchId);
        (await waiter.GetAsync("/api/v1/tables")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
