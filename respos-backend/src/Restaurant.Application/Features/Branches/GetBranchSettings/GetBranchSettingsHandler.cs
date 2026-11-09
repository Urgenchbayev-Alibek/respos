using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Branches.GetBranchSettings;

public sealed record GetBranchSettingsQuery(Guid BranchId);

public sealed class GetBranchSettingsHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<GetBranchSettingsQuery, BranchSettingsDto>
{
    public async Task<Result<BranchSettingsDto>> HandleAsync(GetBranchSettingsQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var settings = await db.BranchSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.BranchId == request.BranchId, cancellationToken);
        return settings is null ? BranchErrors.NotFound : BranchSettingsDto.From(settings);
    }
}
