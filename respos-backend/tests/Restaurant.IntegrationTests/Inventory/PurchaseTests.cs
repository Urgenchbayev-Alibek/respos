using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Inventory;

[Collection(ApiCollection.Name)]
public sealed class PurchaseTests(ApiFactory factory) : InventoryTestBase(factory)
{
    [Fact]
    public async Task Purchase_flow_draft_submit_partial_then_full_receive_with_idempotent_replay()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var rice = await SeedIngredientAsync(org, "Рис", costPrice: 25000m);
        var tea = await SeedIngredientAsync(org, "Чай", "g", costPrice: 100m);
        var kg = await UnitIdAsync(org, "kg");

        var supplier = await client.PostAsJsonAsync("/api/v1/suppliers", new { name = "Агро Опт", phone = "+998 90 123 45 67" }, Json);
        supplier.StatusCode.Should().Be(HttpStatusCode.Created);
        var supplierId = (await ReadJsonAsync(supplier)).GetProperty("id").GetGuid();

        var created = await client.PostAsJsonAsync("/api/v1/purchases", new
        {
            supplierId,
            items = new[] { new { ingredientId = rice, quantity = 10m, unitId = kg, unitPrice = 30000m } },
        }, Json);
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = (await ReadJsonAsync(created)).GetProperty("id").GetGuid();

        var updated = await client.PutAsJsonAsync($"/api/v1/purchases/{id}", new
        {
            supplierId,
            comment = "срочно",
            items = new object[]
            {
                new { ingredientId = rice, quantity = 10m, unitId = kg, unitPrice = 30000m },
                new { ingredientId = tea, quantity = 2m, unitId = kg, unitPrice = 150000m },
            },
        }, Json);
        updated.StatusCode.Should().Be(HttpStatusCode.OK);
        var po = await ReadJsonAsync(updated);
        po.GetProperty("total").GetDecimal().Should().Be(600000m);
        po.GetProperty("number").GetInt32().Should().Be(1);
        var items = po.GetProperty("items").EnumerateArray().ToList();
        var riceItem = items.Single(i => i.GetProperty("ingredientId").GetGuid() == rice).GetProperty("id").GetGuid();
        var teaItem = items.Single(i => i.GetProperty("ingredientId").GetGuid() == tea).GetProperty("id").GetGuid();

        var early = await ReceiveAsync(client, id, Guid.NewGuid(), (riceItem, 1m));
        early.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(early)).Should().Be("purchase.invalid_status_transition");

        (await client.PostAsync($"/api/v1/purchases/{id}/submit", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        var notEditable = await client.PutAsJsonAsync($"/api/v1/purchases/{id}", new
        {
            supplierId,
            items = new[] { new { ingredientId = rice, quantity = 1m, unitId = kg, unitPrice = 1m } },
        }, Json);
        (await ReadErrorCodeAsync(notEditable)).Should().Be("purchase.not_editable");

        var tooMuch = await ReceiveAsync(client, id, Guid.NewGuid(), (riceItem, 11m));
        (await ReadErrorCodeAsync(tooMuch)).Should().Be("purchase.receive_exceeds_remaining");

        var key = Guid.NewGuid();
        var partial = await ReceiveAsync(client, id, key, (riceItem, 4m), (teaItem, 0.5m));
        partial.StatusCode.Should().Be(HttpStatusCode.OK);
        var partialBody = await ReadJsonAsync(partial);
        partialBody.GetProperty("status").GetString().Should().Be("partially_received");

        var replay = await ReceiveAsync(client, id, key, (riceItem, 4m), (teaItem, 0.5m));
        replay.StatusCode.Should().Be(HttpStatusCode.OK);
        replay.Headers.GetValues("Idempotent-Replayed").Should().Contain("true");
        (await MovementsAsync(rice)).Should().ContainSingle();
        (await BalanceAsync(org, rice)).Should().Be(4m);
        (await BalanceAsync(org, tea)).Should().Be(500m);

        var rest = await ReceiveAsync(client, id, Guid.NewGuid(), (riceItem, 6m), (teaItem, 1.5m));
        rest.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(rest)).GetProperty("status").GetString().Should().Be("received");
        (await BalanceAsync(org, rice)).Should().Be(10m);

        var movements = await MovementsAsync(tea);
        movements.Should().OnlyContain(m => m.Type == StockMovementType.Receipt && m.SourceType == StockMovementSource.Purchase && m.SourceId == id);
        movements.Sum(m => m.Quantity).Should().Be(2000m);
        await WithDbAsync(async (db, _) =>
        {
            var costs = await db.Ingredients.IgnoreQueryFilters().Where(i => i.Id == rice || i.Id == tea).ToDictionaryAsync(i => i.Id, i => i.CostPrice);
            costs[rice].Should().Be(30000m);
            costs[tea].Should().Be(150m);
        });

        (await client.PostAsync($"/api/v1/purchases/{id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.Conflict);
        var list = await ReadJsonAsync(await client.GetAsync("/api/v1/purchases?status=received"));
        list.GetProperty("totalCount").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task Purchases_are_isolated_per_tenant_and_draft_can_be_cancelled()
    {
        var orgA = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var orgB = await CreateOrgWithUserAsync(SystemRoles.Stockkeeper);
        var clientA = ClientWithBranch(await LoginAsAsync(orgA.User), orgA.BranchId);
        var clientB = ClientWithBranch(await LoginAsAsync(orgB.User), orgB.BranchId);
        var rice = await SeedIngredientAsync(orgA, "Рис");
        var supplierId = (await ReadJsonAsync(await clientA.PostAsJsonAsync("/api/v1/suppliers", new { name = "Поставщик A" }, Json)))
            .GetProperty("id").GetGuid();
        var created = await clientA.PostAsJsonAsync("/api/v1/purchases", new
        {
            supplierId,
            items = new[] { new { ingredientId = rice, quantity = 1m, unitId = await UnitIdAsync(orgA, "kg"), unitPrice = 1000m } },
        }, Json);
        var id = (await ReadJsonAsync(created)).GetProperty("id").GetGuid();

        (await clientB.GetAsync($"/api/v1/purchases/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await clientB.PostAsync($"/api/v1/purchases/{id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadJsonAsync(await clientB.GetAsync("/api/v1/suppliers"))).GetProperty("totalCount").GetInt32().Should().Be(0);

        var cancelled = await clientA.PostAsync($"/api/v1/purchases/{id}/cancel", null);
        (await ReadJsonAsync(cancelled)).GetProperty("status").GetString().Should().Be("cancelled");
        (await clientA.PostAsync($"/api/v1/suppliers/{supplierId}/archive", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    private static Task<HttpResponseMessage> ReceiveAsync(HttpClient client, Guid id, Guid key, params (Guid ItemId, decimal Quantity)[] lines)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/purchases/{id}/receive")
        {
            Content = JsonContent.Create(new { lines = lines.Select(l => new { itemId = l.ItemId, quantity = l.Quantity }) }, options: Json),
        };
        request.Headers.Add("Idempotency-Key", key.ToString());
        return client.SendAsync(request);
    }
}
