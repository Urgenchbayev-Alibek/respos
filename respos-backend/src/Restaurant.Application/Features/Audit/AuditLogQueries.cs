using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Audit;

namespace Restaurant.Application.Features.Audit;

public sealed record AuditLogDto(
    Guid Id,
    DateTime CreatedAt,
    Guid? OrganizationId,
    Guid? BranchId,
    Guid? UserId,
    string? UserName,
    string Action,
    string EntityType,
    string? EntityId,
    string? CorrelationId,
    string? IpAddress,
    JsonElement? Changes);

/// <summary>Common audit filters: <c>from, to</c> (UTC instants), <c>userId, action</c> (prefix match), <c>entityType, entityId</c>.</summary>
public record AuditLogFilter : PageQuery
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public Guid? UserId { get; init; }
    public string? Action { get; init; }
    public string? EntityType { get; init; }
    public string? EntityId { get; init; }
}

/// <summary>Read side of the append-only audit log (there are no update/delete endpoints by design).</summary>
[ScopedService]
public sealed class AuditLogReader(IApplicationDbContext db)
{
    public IQueryable<AuditLog> Apply(IQueryable<AuditLog> query, AuditLogFilter filter)
    {
        if (filter.From is { } fromValue)
        {
            var from = AsUtc(fromValue);
            query = query.Where(a => a.CreatedAt >= from);
        }

        if (filter.To is { } toValue)
        {
            var to = AsUtc(toValue);
            query = query.Where(a => a.CreatedAt <= to);
        }

        if (filter.UserId is { } userId)
        {
            query = query.Where(a => a.UserId == userId);
        }

        if (!string.IsNullOrWhiteSpace(filter.Action))
        {
            var action = filter.Action.Trim();
            query = query.Where(a => a.Action.StartsWith(action));
        }

        if (!string.IsNullOrWhiteSpace(filter.EntityType))
        {
            var entityType = filter.EntityType.Trim();
            query = query.Where(a => a.EntityType == entityType);
        }

        if (!string.IsNullOrWhiteSpace(filter.EntityId))
        {
            var entityId = filter.EntityId.Trim();
            query = query.Where(a => a.EntityId == entityId);
        }

        return query;
    }

    public async Task<PagedResult<AuditLogDto>> PageAsync(IQueryable<AuditLog> query, PageQuery page, CancellationToken ct)
    {
        var total = await query.CountAsync(ct);
        var rows = await query
            .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
            .Skip((page.SafePage - 1) * page.SafePageSize)
            .Take(page.SafePageSize)
            .Select(a => new
            {
                Log = a,
                UserName = db.Users.Where(u => u.Id == a.UserId).Select(u => u.FullName).FirstOrDefault(),
            })
            .AsNoTracking()
            .ToListAsync(ct);
        var items = rows.Select(r => new AuditLogDto(
                r.Log.Id, r.Log.CreatedAt, r.Log.OrganizationId, r.Log.BranchId, r.Log.UserId, r.UserName, r.Log.Action,
                r.Log.EntityType, r.Log.EntityId, r.Log.CorrelationId, r.Log.IpAddress, ParseChanges(r.Log.ChangesJson)))
            .ToList();
        return new PagedResult<AuditLogDto>(items, page.SafePage, page.SafePageSize, total);
    }

    /// <summary>Query-string instants may bind as Local/Unspecified; the DB column is UTC.</summary>
    public static DateTime AsUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };

    private static JsonElement? ParseChanges(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}

public sealed record ListAuditLogsQuery : AuditLogFilter;

/// <summary><c>GET /audit-logs</c> — the current organization's entries only (AuditLog has no global tenant filter).</summary>
public sealed class ListAuditLogsHandler(IApplicationDbContext db, ITenantContext tenant, AuditLogReader reader)
    : IHandler<ListAuditLogsQuery, PagedResult<AuditLogDto>>
{
    public async Task<Result<PagedResult<AuditLogDto>>> HandleAsync(ListAuditLogsQuery request, CancellationToken cancellationToken)
    {
        var organizationId = tenant.RequireOrganizationId();
        var query = reader.Apply(db.AuditLogs.Where(a => a.OrganizationId == organizationId), request);
        return await reader.PageAsync(query, request, cancellationToken);
    }
}
