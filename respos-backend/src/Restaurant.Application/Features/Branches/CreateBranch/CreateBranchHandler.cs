using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Saas;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Branches.CreateBranch;

/// <summary>Creates a branch with default settings; respects the plan's MaxBranches (422 plan.limit_exceeded).</summary>
public sealed class CreateBranchHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    PlanLimitService planLimits,
    OrganizationProvisioner provisioner,
    IAuditLogger audit) : IHandler<CreateBranchCommand, BranchDto>
{
    public async Task<Result<BranchDto>> HandleAsync(CreateBranchCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var limit = await planLimits.EnsureCanAddBranchAsync(orgId, cancellationToken);
        if (limit.IsFailure)
        {
            return limit.Error;
        }

        var branch = provisioner.CreateBranch(orgId, request.Name.Trim(), request.Timezone ?? RestaurantBranch.DefaultTimezone);
        branch.Address = request.Address;
        branch.Phone = request.Phone;
        audit.Log("branch.created", "branch", branch.Id, request);
        await db.SaveChangesAsync(cancellationToken);
        return BranchDto.From(branch);
    }
}
