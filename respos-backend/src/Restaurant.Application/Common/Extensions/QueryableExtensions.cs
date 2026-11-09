using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Common.Models;

namespace Restaurant.Application.Common.Extensions;

public static class QueryableExtensions
{
    /// <summary>Counts, then fetches one page. Apply ordering before calling.</summary>
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(
        this IQueryable<T> query, PageQuery page, CancellationToken cancellationToken)
    {
        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page.SafePage - 1) * page.SafePageSize)
            .Take(page.SafePageSize)
            .ToListAsync(cancellationToken);
        return new PagedResult<T>(items, page.SafePage, page.SafePageSize, total);
    }

    /// <summary>
    /// Applies <c>sort=field:dir</c> using an allowlist of sortable fields (unknown fields → default ordering).
    /// </summary>
    public static IQueryable<T> ApplySort<T>(
        this IQueryable<T> query,
        PageQuery page,
        IReadOnlyDictionary<string, Expression<Func<T, object>>> sortableFields,
        Expression<Func<T, object>> defaultSort,
        bool defaultDescending = false)
    {
        var (field, descending) = page.ParseSort();
        if (field is not null && sortableFields.TryGetValue(field, out var selector))
        {
            return descending ? query.OrderByDescending(selector) : query.OrderBy(selector);
        }

        return defaultDescending ? query.OrderByDescending(defaultSort) : query.OrderBy(defaultSort);
    }

    /// <summary>Case-insensitive "contains" pattern for EF.Functions.ILike.</summary>
    public static string ToLikePattern(this string search) =>
        "%" + search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}
