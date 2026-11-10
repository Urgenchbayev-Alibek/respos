using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;

namespace Restaurant.Application.Features.Staff.Members;

/// <summary>Employee of the branch for staff screens (schedule grid, timesheet filters, PIN management).</summary>
public sealed record StaffMemberDto(
    Guid UserId, string FullName, string Email, IReadOnlyList<string> Roles, bool HasPin, bool PinAllowed, DateTime? PinLockedUntil);

public sealed record ListMembersQuery;

/// <summary><c>GET /staff/members</c> (<c>staff.manage</c>): active members with access to the current branch.</summary>
public sealed class ListMembersHandler(IApplicationDbContext db, ITenantContext tenant, StaffDirectory directory, IClock clock)
    : IHandler<ListMembersQuery, IReadOnlyList<StaffMemberDto>>
{
    public async Task<Result<IReadOnlyList<StaffMemberDto>>> HandleAsync(ListMembersQuery request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var now = clock.UtcNow;
        var users = await directory.BranchMembers(orgId, branchId)
            .OrderBy(u => u.FullName)
            .Select(u => new { u.Id, u.FullName, u.Email, u.IsPlatformAdmin })
            .ToListAsync(cancellationToken);
        var ids = users.Select(u => u.Id).ToList();
        var roles = await db.UserRoles
            .Where(ur => ids.Contains(ur.UserId))
            .Select(ur => new { ur.UserId, ur.Role!.Code })
            .ToListAsync(cancellationToken);
        var pins = await db.StaffPins.AsNoTracking().Where(p => ids.Contains(p.UserId)).ToDictionaryAsync(p => p.UserId, cancellationToken);

        return users.Select(u =>
        {
            var codes = roles.Where(r => r.UserId == u.Id).Select(r => r.Code).Order(StringComparer.Ordinal).ToList();
            var allowed = !u.IsPlatformAdmin && !codes.Any(c => c is SystemRoles.Owner or SystemRoles.Admin);
            var pin = pins.GetValueOrDefault(u.Id);
            return new StaffMemberDto(
                u.Id, u.FullName, u.Email, codes, pin is not null, allowed, pin is not null && pin.IsLockedOut(now) ? pin.LockoutUntil : null);
        }).ToList();
    }
}
