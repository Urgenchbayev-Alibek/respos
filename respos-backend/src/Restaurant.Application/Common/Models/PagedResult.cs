namespace Restaurant.Application.Common.Models;

/// <summary>Paged list response: <c>{ items, page, pageSize, totalCount }</c>.</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

/// <summary>Common query parameters: <c>?page=1&amp;pageSize=20&amp;sort=createdAt:desc&amp;search=...</c>.</summary>
public record PageQuery
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = DefaultPageSize;
    public string? Sort { get; init; }
    public string? Search { get; init; }

    public int SafePage => Page < 1 ? 1 : Page;

    public int SafePageSize => PageSize switch
    {
        < 1 => DefaultPageSize,
        > MaxPageSize => MaxPageSize,
        _ => PageSize,
    };

    /// <summary>Parses <c>field:asc|desc</c>; returns (null, false) when absent.</summary>
    public (string? Field, bool Descending) ParseSort()
    {
        if (string.IsNullOrWhiteSpace(Sort))
        {
            return (null, false);
        }

        var parts = Sort.Split(':', 2, StringSplitOptions.TrimEntries);
        var descending = parts.Length > 1 && parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase);
        return (parts[0], descending);
    }
}
