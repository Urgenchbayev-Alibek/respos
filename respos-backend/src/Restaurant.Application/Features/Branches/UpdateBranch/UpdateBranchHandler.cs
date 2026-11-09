using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Branches.UpdateBranch;

public sealed class UpdateBranchHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<UpdateBranchCommand, BranchDto>
{
    public async Task<Result<BranchDto>> HandleAsync(UpdateBranchCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);
        if (branch is null)
        {
            return BranchErrors.NotFound;
        }

        branch.Name = request.Name.Trim();
        branch.Address = request.Address;
        branch.Phone = request.Phone;
        if (request.Timezone is not null)
        {
            branch.Timezone = request.Timezone;
        }

        audit.Log("branch.updated", "branch", branch.Id, request);
        await db.SaveChangesAsync(cancellationToken);
        return BranchDto.From(branch);
    }
}
