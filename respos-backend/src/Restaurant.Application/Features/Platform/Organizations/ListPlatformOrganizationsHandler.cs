using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Platform.Organizations;

/// <summary><c>GET /platform/organizations?status=&amp;search=&amp;page=&amp;pageSize=&amp;sort=</c>.</summary>
public sealed record ListPlatformOrganizationsQuery : PageQuery
{
    public OrganizationStatus? Status { get; init; }
}

public sealed class ListPlatformOrganizationsHandler(IApplicationDbContext db)
    : IHandler<ListPlatformOrganizationsQuery, PagedResult<PlatformOrganizationDto>>
{
    private static readonly Dictionary<string, Expression<Func<Organization, object>>> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["name"] = o => o.Name,
        ["slug"] = o => o.Slug,
        ["createdAt"] = o => o.CreatedAt,
        ["status"] = o => o.Status,
    };

    public async Task<Result<PagedResult<PlatformOrganizationDto>>> HandleAsync(
        ListPlatformOrganizationsQuery request, CancellationToken cancellationToken)
    {
        var query = db.Organizations.AsNoTracking();
        if (request.Status is { } status)
        {
            query = query.Where(o => o.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(o => o.Name.ToLower().Contains(term) || o.Slug.Contains(term));
        }

        var ordered = query.ApplySort(request, SortFields, o => o.CreatedAt, defaultDescending: true);
        return await db.ProjectOrganizations(ordered).ToPagedResultAsync(request, cancellationToken);
    }
}
