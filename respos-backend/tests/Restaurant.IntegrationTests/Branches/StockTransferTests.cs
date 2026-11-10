using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;
using Restaurant.IntegrationTests.Inventory;

namespace Restaurant.IntegrationTests.Branches;

[Collection(ApiCollection.Name)]
public sealed class StockTransferTests(ApiFactory factory) : InventoryTestBase(factory)
{
    [Fact]
    public async Task Transfer_send_moves_stock_out_and_idempotent_receive_moves_it_in_with_cost()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var branch2 = await BranchTestData.AddBranchAsync(Factory, org);
        var both = await AddUserAsync(org, SystemRoles.Stockkeeper, org.BranchId, branch2);
        var source = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var destination = ClientWithBranch(await LoginAsAsync(both), branch2);
        var rice = await SeedIngredientAsync(org, "Рис", costPrice: 25000m);
        var (kg, g) = (await UnitIdAsync(org, "kg"), await UnitIdAsync(org, "g"));
        (await PostMovementAsync(source, rice, "receipt", 10m, unitCost: 25000m)).StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await source.PostAsJsonAsync("/api/v1/stock/transfers", new
        {
            toBranchId = branch2,
            comment = "на выходные",
            lines = new[] { new { ingredientId = rice, quantity = 3500m, unitId = g } },
        }, Json);
        created.StatusCode.Should().Be(HttpStatusCode.Created, await created.Content.ReadAsStringAsync());
        var draft = await ReadJsonAsync(created);
        var id = draft.GetProperty("id").GetGuid();
        draft.GetProperty("status").GetString().Should().Be("draft");
        draft.GetProperty("direction").GetString().Should().Be("outgoing");
        draft.GetProperty("lines")[0].GetProperty("baseQuantity").GetDecimal().Should().Be(3.5m);
        (await destination.GetAsync($"/api/v1/stock/transfers/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound, "drafts are private to the source");

        var sent = await source.PostAsync($"/api/v1/stock/transfers/{id}/send", null);
        sent.StatusCode.Should().Be(HttpStatusCode.OK, await sent.Content.ReadAsStringAsync());
        (await BalanceAsync(org, rice)).Should().Be(6.5m);
        (await BranchBalanceAsync(branch2, rice)).Should().Be(0m);
        var editAfterSend = await source.PutAsJsonAsync($"/api/v1/stock/transfers/{id}", new
        {
            toBranchId = branch2,
            lines = new[] { new { ingredientId = rice, quantity = 1m, unitId = kg } },
        }, Json);
        (await ReadErrorCodeAsync(editAfterSend)).Should().Be("stock_transfer.not_editable");

        var wrongSide = await PostWithKeyAsync(source, $"/api/v1/stock/transfers/{id}/receive");
        wrongSide.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(wrongSide)).Should().Be("stock_transfer.destination_branch_required");
        var incoming = await ReadJsonAsync(await destination.GetAsync("/api/v1/stock/transfers?direction=incoming"));
        incoming.GetProperty("items").EnumerateArray().Select(t => t.GetProperty("id").GetGuid()).Should().Equal(id);

        var key = Guid.NewGuid().ToString();
        var received = await PostWithKeyAsync(destination, $"/api/v1/stock/transfers/{id}/receive", key);
        received.StatusCode.Should().Be(HttpStatusCode.OK, await received.Content.ReadAsStringAsync());
        var body = await ReadJsonAsync(received);
        body.GetProperty("status").GetString().Should().Be("received");
        body.GetProperty("direction").GetString().Should().Be("incoming");
        body.GetProperty("totalCost").GetDecimal().Should().Be(87500m);
        var replay = await PostWithKeyAsync(destination, $"/api/v1/stock/transfers/{id}/receive", key);
        replay.StatusCode.Should().Be(HttpStatusCode.OK);
        replay.Headers.GetValues("Idempotent-Replayed").Should().Contain("true");
        var again = await PostWithKeyAsync(destination, $"/api/v1/stock/transfers/{id}/receive");
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(again)).Should().Be("stock_transfer.invalid_status_transition");

        (await BranchBalanceAsync(branch2, rice)).Should().Be(3.5m);
        var movements = (await MovementsAsync(rice)).Where(m => m.SourceType == StockMovementSource.Transfer).ToList();
        movements.Should().HaveCount(2);
        movements.Should().ContainSingle(m => m.Type == StockMovementType.TransferOut && m.BranchId == org.BranchId && m.Quantity == -3.5m && m.UnitCost == 25000m);
        movements.Should().ContainSingle(m => m.Type == StockMovementType.TransferIn && m.BranchId == branch2 && m.Quantity == 3.5m && m.UnitCost == 25000m);
    }

    [Fact]
    public async Task Send_is_atomic_and_respects_the_source_negative_stock_rule()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var branch2 = await BranchTestData.AddBranchAsync(Factory, org);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var rice = await SeedIngredientAsync(org, "Рис", costPrice: 1000m);
        var salt = await SeedIngredientAsync(org, "Соль", costPrice: 500m);
        var kg = await UnitIdAsync(org, "kg");
        await PostMovementAsync(client, rice, "receipt", 10m);
        await PostMovementAsync(client, salt, "receipt", 1m);
        await SetAllowNegativeAsync(org, false);

        var created = await client.PostAsJsonAsync("/api/v1/stock/transfers", new
        {
            toBranchId = branch2,
            lines = new[] { new { ingredientId = rice, quantity = 5m, unitId = kg }, new { ingredientId = salt, quantity = 2m, unitId = kg } },
        }, Json);
        var id = (await ReadJsonAsync(created)).GetProperty("id").GetGuid();

        var refused = await client.PostAsync($"/api/v1/stock/transfers/{id}/send", null);
        refused.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(refused)).Should().Be("stock.insufficient");
        (await BalanceAsync(org, rice)).Should().Be(10m, "nothing is applied when one line fails");
        (await MovementsAsync(rice)).Should().NotContain(m => m.Type == StockMovementType.TransferOut);
        (await ReadJsonAsync(await client.GetAsync($"/api/v1/stock/transfers/{id}"))).GetProperty("status").GetString().Should().Be("draft");

        await SetAllowNegativeAsync(org, true);
        (await client.PostAsync($"/api/v1/stock/transfers/{id}/send", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await BalanceAsync(org, rice)).Should().Be(5m);
        (await BalanceAsync(org, salt)).Should().Be(-1m);

        var cancelled = await client.PostAsync($"/api/v1/stock/transfers/{id}/cancel", null);
        cancelled.StatusCode.Should().Be(HttpStatusCode.OK);
        (await BalanceAsync(org, rice)).Should().Be(10m, "cancelling a sent transfer returns the stock to the source");
        (await BalanceAsync(org, salt)).Should().Be(1m);
    }

    [Fact]
    public async Task Branch_access_and_tenant_rules_are_enforced()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var branch2 = await BranchTestData.AddBranchAsync(Factory, org);
        var other = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var source = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var rice = await SeedIngredientAsync(org, "Рис");
        var kg = await UnitIdAsync(org, "kg");
        await PostMovementAsync(source, rice, "receipt", 10m);
        object Body(Guid to) => new { toBranchId = to, lines = new[] { new { ingredientId = rice, quantity = 1m, unitId = kg } } };

        (await ReadErrorCodeAsync(await source.PostAsJsonAsync("/api/v1/stock/transfers", Body(org.BranchId), Json)))
            .Should().Be("stock_transfer.same_branch");
        (await ReadErrorCodeAsync(await source.PostAsJsonAsync("/api/v1/stock/transfers", Body(other.BranchId), Json)))
            .Should().Be("stock_transfer.destination_not_found");
        var id = (await ReadJsonAsync(await source.PostAsJsonAsync("/api/v1/stock/transfers", Body(branch2), Json))).GetProperty("id").GetGuid();
        (await source.PostAsync($"/api/v1/stock/transfers/{id}/send", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        var noAccess = ClientWithBranch(await LoginAsAsync(org.User), branch2);
        var forbidden = await PostWithKeyAsync(noAccess, $"/api/v1/stock/transfers/{id}/receive");
        forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(forbidden)).Should().Be("tenant.branch_forbidden");

        var waiter = ClientWithBranch(await LoginAsAsync(await AddUserAsync(org, SystemRoles.Waiter, org.BranchId, branch2)), branch2);
        (await PostWithKeyAsync(waiter, $"/api/v1/stock/transfers/{id}/receive")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var destinationUser = ClientWithBranch(await LoginAsAsync(await AddUserAsync(org, SystemRoles.Stockkeeper, branch2)), branch2);
        var cancelFromDestination = await destinationUser.PostAsync($"/api/v1/stock/transfers/{id}/cancel", null);
        (await ReadErrorCodeAsync(cancelFromDestination)).Should().Be("stock_transfer.source_branch_required");

        var stranger = ClientWithBranch(await LoginAsAsync(other.User), other.BranchId);
        (await stranger.GetAsync($"/api/v1/stock/transfers/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await PostWithKeyAsync(stranger, $"/api/v1/stock/transfers/{id}/receive")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadJsonAsync(await stranger.GetAsync("/api/v1/stock/transfers"))).GetProperty("totalCount").GetInt32().Should().Be(0);
        (await BranchBalanceAsync(branch2, rice)).Should().Be(0m);
    }

    private async Task<decimal> BranchBalanceAsync(Guid branchId, Guid ingredientId)
    {
        decimal quantity = 0m;
        await WithDbAsync(async (db, _) =>
            quantity = await db.StockBalances.IgnoreQueryFilters()
                .Where(b => b.BranchId == branchId && b.IngredientId == ingredientId)
                .Select(b => b.Quantity).FirstOrDefaultAsync());
        return quantity;
    }

    private static Task<HttpResponseMessage> PostWithKeyAsync(HttpClient client, string url, string? key = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(new { }, options: Json) };
        request.Headers.Add("Idempotency-Key", key ?? Guid.NewGuid().ToString());
        return client.SendAsync(request);
    }
}
