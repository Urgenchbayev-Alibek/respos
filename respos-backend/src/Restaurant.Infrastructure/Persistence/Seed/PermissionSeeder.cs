using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Persistence.Seed;

/// <summary>
/// Syncs <see cref="PermissionCatalog"/> into the permissions table (insert/update/delete obsolete)
/// and re-syncs every system role of every organization to its <see cref="SystemRoles"/> definition.
/// </summary>
internal sealed class PermissionSeeder : IDataSeeder
{
    public int Order => 10;

    public async Task SeedAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await SyncCatalogAsync(db, cancellationToken);
        await SyncSystemRolesAsync(db, cancellationToken);
    }

    private static async Task SyncCatalogAsync(AppDbContext db, CancellationToken ct)
    {
        var existing = await db.Permissions.ToDictionaryAsync(p => p.Code, StringComparer.Ordinal, ct);
        foreach (var definition in PermissionCatalog.All)
        {
            if (existing.TryGetValue(definition.Code, out var permission))
            {
                permission.Module = definition.Module;
                permission.Description = definition.Description;
            }
            else
            {
                db.Permissions.Add(new Permission
                {
                    Code = definition.Code,
                    Module = definition.Module,
                    Description = definition.Description,
                });
            }
        }

        var obsolete = existing.Keys.Where(code => !PermissionCatalog.Exists(code)).ToList();
        if (obsolete.Count > 0)
        {
            await db.RolePermissions.Where(rp => obsolete.Contains(rp.PermissionCode)).ExecuteDeleteAsync(ct);
            db.Permissions.RemoveRange(obsolete.Select(code => existing[code]));
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SyncSystemRolesAsync(AppDbContext db, CancellationToken ct)
    {
        var roles = await db.Roles.IgnoreQueryFilters()
            .Where(r => r.IsSystem)
            .Include(r => r.Permissions)
            .ToListAsync(ct);
        foreach (var role in roles)
        {
            var definition = SystemRoles.All.FirstOrDefault(d => d.Code == role.Code);
            if (definition is not null)
            {
                role.SetPermissions(definition.Permissions);
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
