using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Organizations.UpdateOrganization;

public sealed class UpdateOrganizationHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<UpdateOrganizationCommand, OrganizationDto>
{
    public async Task<Result<OrganizationDto>> HandleAsync(UpdateOrganizationCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var organization = await db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, cancellationToken);
        if (organization is null)
        {
            return OrganizationErrors.NotFound;
        }

        organization.Name = request.Name.Trim();
        organization.Currency = request.Currency;
        organization.DefaultLanguage = request.DefaultLanguage;
        audit.Log("organization.updated", "organization", organization.Id, request);
        await db.SaveChangesAsync(cancellationToken);
        return OrganizationDto.From(organization);
    }
}
