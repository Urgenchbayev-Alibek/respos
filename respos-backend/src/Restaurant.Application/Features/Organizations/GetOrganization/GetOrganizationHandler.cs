using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Organizations.GetOrganization;

public sealed class GetOrganizationHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<GetOrganizationQuery, OrganizationDto>
{
    public async Task<Result<OrganizationDto>> HandleAsync(GetOrganizationQuery request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var organization = await db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orgId, cancellationToken);
        return organization is null ? OrganizationErrors.NotFound : OrganizationDto.From(organization);
    }
}
