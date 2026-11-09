using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Users.Common;

/// <summary>
/// Shared user-management rules: role/branch validation (current org only, via tenant filters),
/// owner protection, last-owner guard, assignment replacement and session revocation.
/// </summary>
[ScopedService]
public sealed class UserAssignmentService(IApplicationDbContext db, ITenantContext tenant, IClock clock)
{
    public async Task<Result<IReadOnlyList<Role>>> ResolveRolesAsync(IReadOnlyCollection<Guid> roleIds, CancellationToken ct)
    {
        var distinct = roleIds.Distinct().ToList();
        var roles = await db.Roles.Where(r => distinct.Contains(r.Id)).ToListAsync(ct);
        return roles.Count == distinct.Count ? roles : Result.Failure<IReadOnlyList<Role>>(UserErrors.InvalidRoles);
    }

    public async Task<Result> ValidateBranchesAsync(IReadOnlyCollection<Guid> branchIds, CancellationToken ct)
    {
        var distinct = branchIds.Distinct().ToList();
        var found = await db.Branches.CountAsync(b => distinct.Contains(b.Id), ct);
        return found == distinct.Count ? Result.Success() : Result.Failure(UserErrors.InvalidBranches);
    }

    public Task<bool> IsOwnerAsync(Guid userId, CancellationToken ct) =>
        db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.Role!.Code == SystemRoles.Owner, ct);

    /// <summary>Non-owners may not modify an owner nor assign the owner role (403 users.owner_protected).</summary>
    public async Task<Result> EnsureActorMayManageAsync(Guid? targetUserId, bool assignsOwnerRole, CancellationToken ct)
    {
        var actorId = tenant.RequireUserId();
        if (await IsOwnerAsync(actorId, ct))
        {
            return Result.Success();
        }

        var targetIsOwner = targetUserId is { } target && await IsOwnerAsync(target, ct);
        return assignsOwnerRole || targetIsOwner ? Result.Failure(UserErrors.OwnerProtected) : Result.Success();
    }

    /// <summary>Fails when <paramref name="userId"/> is the only active owner of the organization.</summary>
    public async Task<Result> EnsureNotLastOwnerAsync(Guid userId, CancellationToken ct)
    {
        if (!await IsOwnerAsync(userId, ct))
        {
            return Result.Success();
        }

        var otherActiveOwners = await db.UserRoles.CountAsync(
            ur => ur.Role!.Code == SystemRoles.Owner
                  && ur.UserId != userId
                  && ur.User!.Status == UserStatus.Active
                  && db.UserOrganizations.Any(uo => uo.UserId == ur.UserId && uo.IsActive),
            ct);
        return otherActiveOwners > 0 ? Result.Success() : Result.Failure(UserErrors.LastOwner);
    }

    /// <summary>Replaces roles and explicit branch access in the current org (diff-based: no delete+re-add of the same key).</summary>
    public async Task ReplaceAssignmentsAsync(Guid userId, IReadOnlyList<Role> roles, IReadOnlyCollection<Guid> branchIds, CancellationToken ct)
    {
        var orgId = tenant.RequireOrganizationId();
        var wantedRoles = roles.Select(r => r.Id).ToHashSet();
        var currentRoles = await db.UserRoles.Where(ur => ur.UserId == userId).ToListAsync(ct);
        db.UserRoles.RemoveRange(currentRoles.Where(ur => !wantedRoles.Contains(ur.RoleId)));
        db.UserRoles.AddRange(wantedRoles.Where(id => currentRoles.All(ur => ur.RoleId != id))
            .Select(id => new UserRole { OrganizationId = orgId, UserId = userId, RoleId = id }));

        var wantedBranches = branchIds.ToHashSet();
        var currentBranches = await db.UserBranchAccesses.Where(a => a.UserId == userId).ToListAsync(ct);
        db.UserBranchAccesses.RemoveRange(currentBranches.Where(a => !wantedBranches.Contains(a.BranchId)));
        db.UserBranchAccesses.AddRange(wantedBranches.Where(id => currentBranches.All(a => a.BranchId != id))
            .Select(id => new UserBranchAccess { OrganizationId = orgId, UserId = userId, BranchId = id }));
    }

    /// <summary>Revokes all active refresh tokens of the user (saved with the caller's unit of work).</summary>
    public async Task RevokeSessionsAsync(Guid userId, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var tokens = await db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync(ct);
        tokens.ForEach(t => t.Revoke(now));
    }
}
