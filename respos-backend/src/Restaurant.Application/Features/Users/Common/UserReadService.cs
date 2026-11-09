using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Users.Common;

/// <summary>Builds <see cref="UserDto"/>s for users of the CURRENT organization (roles/branches via tenant filters).</summary>
[ScopedService]
public sealed class UserReadService(IApplicationDbContext db)
{
    /// <summary>Users that are members (active or not) of the current organization.</summary>
    public IQueryable<User> OrganizationUsers() =>
        db.Users.AsNoTracking().Where(u => db.UserOrganizations.Any(uo => uo.UserId == u.Id));

    public async Task<UserDto?> GetAsync(Guid userId, CancellationToken ct)
    {
        var user = await OrganizationUsers().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return null;
        }

        var dtos = await BuildAsync([user], ct);
        return dtos[0];
    }

    public async Task<IReadOnlyList<UserDto>> BuildAsync(IReadOnlyList<User> users, CancellationToken ct)
    {
        var ids = users.Select(u => u.Id).ToList();
        var roles = await db.UserRoles.AsNoTracking()
            .Where(ur => ids.Contains(ur.UserId))
            .Select(ur => new { ur.UserId, Role = new UserRoleDto(ur.Role!.Id, ur.Role.Code, ur.Role.Name) })
            .ToListAsync(ct);
        var branches = await db.UserBranchAccesses.AsNoTracking()
            .Where(a => ids.Contains(a.UserId))
            .Select(a => new { a.UserId, Branch = new UserBranchDto(a.Branch!.Id, a.Branch.Name) })
            .ToListAsync(ct);

        return users.Select(u => new UserDto(
                u.Id,
                u.Email,
                u.FullName,
                u.Phone,
                u.Status,
                roles.Where(r => r.UserId == u.Id).Select(r => r.Role).OrderBy(r => r.Name).ToList(),
                branches.Where(b => b.UserId == u.Id).Select(b => b.Branch).OrderBy(b => b.Name).ToList(),
                u.LastLoginAt))
            .ToList();
    }
}
