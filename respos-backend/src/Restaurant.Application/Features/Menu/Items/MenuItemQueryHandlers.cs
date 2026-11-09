using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.Items;

public sealed class ListMenuItemsHandler(ITenantContext tenant, MenuReadService reader)
    : IHandler<ListMenuItemsQuery, PagedResult<MenuItemDto>>
{
    private static readonly Dictionary<string, Expression<Func<MenuItem, object>>> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["name"] = i => i.Name,
        ["price"] = i => i.Price,
        ["createdAt"] = i => i.CreatedAt,
        ["prepTimeMinutes"] = i => i.PrepTimeMinutes,
    };

    public async Task<Result<PagedResult<MenuItemDto>>> HandleAsync(ListMenuItemsQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var query = reader.ItemsWithDetails();
        if (!request.IncludeArchived)
        {
            query = query.Where(i => !i.IsArchived);
        }

        if (request.CategoryId is { } categoryId)
        {
            query = query.Where(i => i.CategoryId == categoryId);
        }

        if (request.IsAvailable is { } available)
        {
            query = query.Where(i => i.IsAvailable == available);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(i => i.Name.ToLower().Contains(term)
                                     || (i.NameUz != null && i.NameUz.ToLower().Contains(term))
                                     || (i.Sku != null && i.Sku.ToLower().Contains(term)));
        }

        var page = await query.ApplySort(request, SortFields, i => i.Name).ToPagedResultAsync(request, cancellationToken);
        return new PagedResult<MenuItemDto>(page.Items.Select(MenuReadService.ToDto).ToList(), page.Page, page.PageSize, page.TotalCount);
    }
}

/// <summary>Single item (archived included, so history screens can resolve it). Other tenant's id → 404.</summary>
public sealed class GetMenuItemHandler(ITenantContext tenant, MenuReadService reader) : IHandler<GetMenuItemQuery, MenuItemDto>
{
    public async Task<Result<MenuItemDto>> HandleAsync(GetMenuItemQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var item = await reader.GetItemAsync(request.Id, cancellationToken);
        return item is null ? Result.Failure<MenuItemDto>(MenuErrors.ItemNotFound) : item;
    }
}
