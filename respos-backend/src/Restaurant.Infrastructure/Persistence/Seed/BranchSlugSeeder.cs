using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Persistence.Seed;

/// <summary>
/// Backfills <see cref="RestaurantBranch.Slug"/> for branches created before QR menus existed (idempotent, every start).
/// The demo organization's first branch gets "demo" when it is free.
/// </summary>
internal sealed class BranchSlugSeeder : IDataSeeder
{
    private const string DemoSlug = "demo";

    public int Order => 150;

    public async Task SeedAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var branches = await db.Branches.IgnoreQueryFilters()
            .Where(b => b.Slug == null)
            .OrderBy(b => b.CreatedAt)
            .ToListAsync(cancellationToken);
        if (branches.Count == 0)
        {
            return;
        }

        var demoOrgIds = await db.Organizations.IgnoreQueryFilters()
            .Where(o => o.Slug == DemoSlug)
            .Select(o => o.Id)
            .ToListAsync(cancellationToken);
        var demoSlugFree = !await db.Branches.IgnoreQueryFilters().AnyAsync(b => b.Slug == DemoSlug, cancellationToken);
        foreach (var branch in branches)
        {
            if (demoSlugFree && demoOrgIds.Contains(branch.OrganizationId))
            {
                branch.Slug = DemoSlug;
                demoSlugFree = false;
                continue;
            }

            branch.Slug = BranchSlug.Generate(branch.Name, branch.Id);
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
