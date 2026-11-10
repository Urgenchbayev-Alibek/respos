using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Staff.Common;

/// <summary>
/// Branch staff lookups with explicit ids (ignore tenant filters, so they also work for anonymous device requests):
/// active members of the organization who can access the branch (explicit access or an all-branch role).
/// </summary>
[ScopedService]
public sealed class StaffDirectory(IApplicationDbContext db)
{
    private static readonly string[] AllBranchRoles = [.. SystemRoles.AllBranchRoles];

    /// <summary>Owner/admin roles and platform admins must use the password (ADR-0014).</summary>
    private static readonly string[] PinForbiddenRoles = [SystemRoles.Owner, SystemRoles.Admin];

    public IQueryable<User> BranchMembers(Guid organizationId, Guid branchId) =>
        db.Users.Where(u => u.Status == UserStatus.Active
            && db.UserOrganizations.IgnoreQueryFilters()
                .Any(uo => uo.UserId == u.Id && uo.OrganizationId == organizationId && uo.IsActive)
            && db.Branches.IgnoreQueryFilters()
                .Any(b => b.Id == branchId && b.OrganizationId == organizationId && b.IsActive)
            && (db.UserBranchAccesses.IgnoreQueryFilters()
                    .Any(a => a.UserId == u.Id && a.BranchId == branchId && a.OrganizationId == organizationId)
                || db.UserRoles.IgnoreQueryFilters()
                    .Any(ur => ur.UserId == u.Id && ur.OrganizationId == organizationId && AllBranchRoles.Contains(ur.Role!.Code))));

    /// <summary>Branch members allowed to use a PIN: not platform admins, no owner/admin role in the organization.</summary>
    public IQueryable<User> PinEligibleMembers(Guid organizationId, Guid branchId) =>
        BranchMembers(organizationId, branchId).Where(u => !u.IsPlatformAdmin
            && !db.UserRoles.IgnoreQueryFilters()
                .Any(ur => ur.UserId == u.Id && ur.OrganizationId == organizationId && PinForbiddenRoles.Contains(ur.Role!.Code)));

    public Task<bool> IsBranchMemberAsync(Guid userId, Guid organizationId, Guid branchId, CancellationToken ct) =>
        BranchMembers(organizationId, branchId).AnyAsync(u => u.Id == userId, ct);

    public Task<bool> IsPinEligibleAsync(Guid userId, Guid organizationId, Guid branchId, CancellationToken ct) =>
        PinEligibleMembers(organizationId, branchId).AnyAsync(u => u.Id == userId, ct);

    /// <summary>True when the user holds an owner/admin role in the organization or is a platform admin.</summary>
    public async Task<bool> IsPinForbiddenAsync(User user, Guid? organizationId, CancellationToken ct) =>
        user.IsPlatformAdmin
        || await db.UserRoles.IgnoreQueryFilters().AnyAsync(
            ur => ur.UserId == user.Id
                  && (organizationId == null || ur.OrganizationId == organizationId)
                  && PinForbiddenRoles.Contains(ur.Role!.Code), ct);

    public async Task<IReadOnlyDictionary<Guid, string>> NamesAsync(IEnumerable<Guid> userIds, CancellationToken ct)
    {
        var ids = userIds.Distinct().ToList();
        return ids.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
    }
}
