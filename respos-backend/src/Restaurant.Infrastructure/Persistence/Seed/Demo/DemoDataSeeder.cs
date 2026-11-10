using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Saas;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Persistence.Seed.Demo;

/// <summary>Shared state for the demo seeding steps (all tenant rows get explicit OrganizationId/BranchId).</summary>
internal sealed record DemoContext(
    AppDbContext Db,
    Guid OrganizationId,
    Guid BranchId,
    DateTime Now,
    IReadOnlyDictionary<string, UnitOfMeasure> Units);

/// <summary>
/// Development-only demo organization "Demo Restaurant (DEMO)" (IsDemo = true). Runs once: skipped when the
/// organization with slug "demo" exists. Everything is created in one transaction.
/// </summary>
internal sealed class DemoDataSeeder(
    OrganizationProvisioner provisioner,
    IPasswordHasher hasher,
    IClock clock,
    IHostEnvironment environment,
    IOptions<SeedOptions> options,
    ILogger<DemoDataSeeder> logger) : IDataSeeder
{
    public const string Slug = "demo";

    public int Order => 100;

    public async Task SeedAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        if (!SeedingRegistration.DemoSeedingAllowed(environment, options)
            || await db.Organizations.AnyAsync(o => o.Slug == Slug, cancellationToken))
        {
            return;
        }

        await db.ExecuteInTransactionAsync(async ct =>
        {
            await SeedDemoAsync(db, ct);
            return true;
        }, cancellationToken);
        logger.LogInformation("Demo organization seeded (users @{Domain})", DemoUsers.Domain);
    }

    private async Task SeedDemoAsync(AppDbContext db, CancellationToken ct)
    {
        var provisioned = await provisioner.CreateAsync(
            new NewOrganization("Demo Restaurant (DEMO)", Slug, "Ташкент — Центр", Plan.Business, IsDemo: true), ct);
        var orgId = provisioned.Organization.Id;
        provisioned.Branch.Address = "г. Ташкент, ул. Амира Темура, 1 (демо)";
        provisioned.Branch.Phone = "+998 71 200-00-00";
        provisioned.Branch.Slug = Slug;

        var units = db.Units.Local.Where(u => u.OrganizationId == orgId).ToDictionary(u => u.Code, StringComparer.Ordinal);
        var context = new DemoContext(db, orgId, provisioned.Branch.Id, clock.UtcNow, units);

        DemoUsers.Add(context, provisioner, provisioned, hasher.Hash(options.Value.DemoPassword));
        var stations = DemoFloor.Add(context);
        var menu = DemoMenu.Add(context, stations);
        var ingredients = DemoInventory.Add(context);
        DemoRecipes.Add(context, menu, ingredients);
        await db.SaveChangesAsync(ct);
    }
}
