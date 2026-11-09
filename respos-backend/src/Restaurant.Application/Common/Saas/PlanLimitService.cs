using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Errors;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Saas;

namespace Restaurant.Application.Common.Saas;

/// <summary>Subscription plan limits for the current organization. No current subscription = no limits.</summary>
[ScopedService]
public sealed class PlanLimitService(IApplicationDbContext db, IClock clock)
{
    public async Task<Plan?> GetCurrentPlanAsync(Guid organizationId, CancellationToken ct)
    {
        var subscriptions = await db.Subscriptions.AsNoTracking()
            .Include(s => s.Plan)
            .Where(s => s.OrganizationId == organizationId)
            .ToListAsync(ct);
        var now = clock.UtcNow;
        return subscriptions
            .Where(s => s.IsCurrent(now))
            .OrderByDescending(s => s.StartsAt)
            .Select(s => s.Plan)
            .FirstOrDefault();
    }

    public async Task<Result> EnsureCanAddBranchAsync(Guid organizationId, CancellationToken ct)
    {
        var plan = await GetCurrentPlanAsync(organizationId, ct);
        if (plan is null)
        {
            return Result.Success();
        }

        var active = await db.Branches.CountAsync(b => b.OrganizationId == organizationId && b.IsActive, ct);
        return active < plan.MaxBranches ? Result.Success() : Result.Failure(PlanErrors.LimitExceeded("branches"));
    }

    public async Task<Result> EnsureCanAddUserAsync(Guid organizationId, CancellationToken ct)
    {
        var plan = await GetCurrentPlanAsync(organizationId, ct);
        if (plan is null)
        {
            return Result.Success();
        }

        var members = await db.UserOrganizations.CountAsync(uo => uo.OrganizationId == organizationId && uo.IsActive, ct);
        return members < plan.MaxUsers ? Result.Success() : Result.Failure(PlanErrors.LimitExceeded("users"));
    }
}
