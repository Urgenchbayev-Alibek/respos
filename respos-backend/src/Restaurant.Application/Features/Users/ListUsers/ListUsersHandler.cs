using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Users.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Users.ListUsers;

/// <summary><c>GET /users?status=&amp;roleId=&amp;branchId=&amp;search=&amp;page=&amp;pageSize=&amp;sort=</c>.</summary>
public sealed record ListUsersQuery : PageQuery
{
    public UserStatus? Status { get; init; }
    public Guid? RoleId { get; init; }
    public Guid? BranchId { get; init; }
}

public sealed class ListUsersHandler(IApplicationDbContext db, ITenantContext tenant, UserReadService reader)
    : IHandler<ListUsersQuery, PagedResult<UserDto>>
{
    private static readonly Dictionary<string, Expression<Func<User, object>>> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["email"] = u => u.Email,
        ["fullName"] = u => u.FullName,
        ["createdAt"] = u => u.CreatedAt,
        ["lastLoginAt"] = u => u.LastLoginAt!,
        ["status"] = u => u.Status,
    };

    public async Task<Result<PagedResult<UserDto>>> HandleAsync(ListUsersQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var query = reader.OrganizationUsers();
        if (request.Status is { } status)
        {
            query = query.Where(u => u.Status == status);
        }

        if (request.RoleId is { } roleId)
        {
            query = query.Where(u => db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == roleId));
        }

        if (request.BranchId is { } branchId)
        {
            query = query.Where(u => db.UserBranchAccesses.Any(a => a.UserId == u.Id && a.BranchId == branchId));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(u => u.Email.Contains(term) || u.FullName.ToLower().Contains(term));
        }

        var page = await query.ApplySort(request, SortFields, u => u.FullName).ToPagedResultAsync(request, cancellationToken);
        var items = await reader.BuildAsync(page.Items, cancellationToken);
        return new PagedResult<UserDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
