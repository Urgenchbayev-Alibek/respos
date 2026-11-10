using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Persistence.Seed.Demo;

/// <summary>
/// Development-only (F4): second demo branch "Ташкент — Чиланзар" with floor, kitchen stations, some stock (several items
/// below minimum), access for manager@ and stock@ (owner/admin see every branch), station overrides + two price overrides,
/// and default suppliers for the demo ingredients. Runs once after <see cref="DemoDataSeeder"/>; existing demo data untouched.
/// </summary>
internal sealed class DemoSecondBranchSeeder(
    OrganizationProvisioner provisioner,
    IClock clock,
    IHostEnvironment environment,
    IOptions<SeedOptions> options,
    ILogger<DemoSecondBranchSeeder> logger) : IDataSeeder
{
    public const string BranchName = "Ташкент — Чиланзар";
    private const decimal PriceMarkup = 5000m;

    private static readonly string[] AccessLogins = ["manager", "stock"];

    private static readonly (string Sku, decimal Quantity, decimal Min)[] Stock =
    [
        ("RICE", 15m, 10m), ("CARROT", 6m, 8m), ("LAMB", 4m, 5m), ("BEEF", 6m, 4m), ("ONION", 10m, 5m),
        ("FLOUR", 12m, 10m), ("OIL", 3m, 5m), ("TEA_GREEN", 800m, 500m), ("TEA_BLACK", 1200m, 500m), ("COLA", 10m, 12m),
    ];

    private static readonly string[] MeatSkus = ["LAMB", "BEEF", "CHICKEN"];

    public int Order => 110;

    public async Task SeedAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        if (!SeedingRegistration.DemoSeedingAllowed(environment, options))
        {
            return;
        }

        var orgId = await db.Organizations.Where(o => o.Slug == DemoDataSeeder.Slug).Select(o => (Guid?)o.Id).FirstOrDefaultAsync(cancellationToken);
        if (orgId is not { } organizationId
            || await db.Branches.IgnoreQueryFilters().AnyAsync(b => b.OrganizationId == organizationId && b.Name == BranchName, cancellationToken))
        {
            return;
        }

        await db.ExecuteInTransactionAsync(async ct =>
        {
            await SeedBranchAsync(db, organizationId, ct);
            return true;
        }, cancellationToken);
        logger.LogInformation("Second demo branch seeded ({Branch})", BranchName);
    }

    private async Task SeedBranchAsync(AppDbContext db, Guid orgId, CancellationToken ct)
    {
        var branch = provisioner.CreateBranch(orgId, BranchName);
        branch.Address = "г. Ташкент, Чиланзарский р-н, ул. Бунёдкор, 15 (демо)";
        branch.Phone = "+998 71 200-00-01";
        var units = await db.Units.IgnoreQueryFilters().Where(u => u.OrganizationId == orgId).ToDictionaryAsync(u => u.Code, StringComparer.Ordinal, ct);
        var context = new DemoContext(db, orgId, branch.Id, clock.UtcNow, units);
        var stations = DemoFloor.Add(context);

        var emails = AccessLogins.Select(l => $"{l}@{DemoUsers.Domain}").ToList();
        var userIds = await db.Users.Where(u => emails.Contains(u.Email)).Select(u => u.Id).ToListAsync(ct);
        db.UserBranchAccesses.AddRange(userIds.Select(id => new UserBranchAccess { OrganizationId = orgId, UserId = id, BranchId = branch.Id }));

        var ingredients = await db.Ingredients.IgnoreQueryFilters().Where(i => i.OrganizationId == orgId && i.Sku != null).ToListAsync(ct);
        var bySku = ingredients.ToDictionary(i => i.Sku!, StringComparer.Ordinal);
        foreach (var (sku, quantity, min) in Stock.Where(s => bySku.ContainsKey(s.Sku)))
        {
            DemoInventory.AddOpeningBalance(context, bySku[sku], quantity, min);
        }

        await AssignDefaultSuppliersAsync(db, orgId, ingredients, ct);
        await AddMenuOverridesAsync(db, orgId, branch.Id, stations, ct);
        await db.SaveChangesAsync(ct);
    }

    private static async Task AssignDefaultSuppliersAsync(AppDbContext db, Guid orgId, IReadOnlyList<Domain.Entities.Inventory.Ingredient> ingredients, CancellationToken ct)
    {
        var suppliers = await db.Suppliers.IgnoreQueryFilters().Where(s => s.OrganizationId == orgId && !s.IsArchived)
            .OrderBy(s => s.CreatedAt).ToListAsync(ct);
        var meat = suppliers.FirstOrDefault(s => s.Name.Contains("Мясной", StringComparison.Ordinal));
        var general = suppliers.FirstOrDefault(s => s != meat);
        foreach (var ingredient in ingredients.Where(i => i.DefaultSupplierId is null))
        {
            ingredient.DefaultSupplierId = MeatSkus.Contains(ingredient.Sku) ? meat?.Id ?? general?.Id : general?.Id;
        }
    }

    /// <summary>Items routed to a station of the main branch → the same-named station here; the two priciest items +5 000.</summary>
    private static async Task AddMenuOverridesAsync(AppDbContext db, Guid orgId, Guid branchId, DemoStations stations, CancellationToken ct)
    {
        var stationNames = await db.KitchenStations.IgnoreQueryFilters().Where(s => s.OrganizationId == orgId && s.BranchId != branchId)
            .ToDictionaryAsync(s => s.Id, s => s.Name, ct);
        var local = new[] { stations.Hot, stations.Cold, stations.Bar }.ToDictionary(s => s.Name, s => s.Id, StringComparer.Ordinal);
        var items = await db.MenuItems.IgnoreQueryFilters().AsNoTracking().Where(i => i.OrganizationId == orgId && !i.IsArchived)
            .ToListAsync(ct);
        var pricier = items.OrderByDescending(i => i.Price).Take(2).Select(i => i.Id).ToHashSet();
        foreach (var item in items)
        {
            Guid? station = item.KitchenStationId is { } s && stationNames.TryGetValue(s, out var name) && local.TryGetValue(name, out var id)
                ? id
                : null;
            decimal? price = pricier.Contains(item.Id) ? item.Price + PriceMarkup : null;
            if (station is null && price is null)
            {
                continue;
            }

            db.BranchMenuItems.Add(new BranchMenuItem
            {
                OrganizationId = orgId,
                BranchId = branchId,
                MenuItemId = item.Id,
                KitchenStationId = station,
                PriceOverride = price,
            });
        }
    }
}
