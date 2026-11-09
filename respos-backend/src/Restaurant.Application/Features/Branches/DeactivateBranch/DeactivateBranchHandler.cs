using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Branches.DeactivateBranch;

public sealed record DeactivateBranchCommand(Guid Id);

/// <summary>Deactivates a branch (never deletes); the last active branch is protected (422 branches.last_active).</summary>
public sealed class DeactivateBranchHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<DeactivateBranchCommand, BranchDto>
{
    public async Task<Result<BranchDto>> HandleAsync(DeactivateBranchCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);
        if (branch is null)
        {
            return BranchErrors.NotFound;
        }

        if (!branch.IsActive)
        {
            return BranchDto.From(branch);
        }

        var otherActive = await db.Branches.AnyAsync(b => b.Id != branch.Id && b.IsActive, cancellationToken);
        if (!otherActive)
        {
            return BranchErrors.LastActive;
        }

        branch.IsActive = false;
        audit.Log("branch.deactivated", "branch", branch.Id);
        await db.SaveChangesAsync(cancellationToken);
        return BranchDto.From(branch);
    }
}
