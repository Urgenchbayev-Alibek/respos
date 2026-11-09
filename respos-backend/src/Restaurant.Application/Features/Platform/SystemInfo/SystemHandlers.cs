using System.Diagnostics;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Audit;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Platform.SystemInfo;

/// <summary><see cref="Environment"/> is the host environment name (passed by the API layer).</summary>
public sealed record GetSystemInfoQuery(string Environment);

/// <summary><c>uptime</c> in seconds since process start; counts are platform-wide aggregates only.</summary>
public sealed record SystemInfoDto(
    string Version,
    string Environment,
    string DbStatus,
    long Uptime,
    DateTime StartedAt,
    int OrganizationsCount,
    int UsersCount,
    int OrdersToday);

/// <summary><c>GET /platform/system</c>. <c>ordersToday</c> = orders opened since local midnight (Asia/Tashkent).</summary>
public sealed class GetSystemInfoHandler(IApplicationDbContext db, IClock clock, ILogger<GetSystemInfoHandler> logger)
    : IHandler<GetSystemInfoQuery, SystemInfoDto>
{
    private static readonly DateTime StartedAt = Process.GetCurrentProcess().StartTime.ToUniversalTime();

    private static readonly string Version =
        typeof(GetSystemInfoHandler).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? typeof(GetSystemInfoHandler).Assembly.GetName().Version?.ToString()
        ?? "unknown";

    public async Task<Result<SystemInfoDto>> HandleAsync(GetSystemInfoQuery request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var uptime = (long)Math.Max(0, (now - StartedAt).TotalSeconds);
        var zone = BranchTime.Resolve(null);
        var todayStart = BranchTime.ToUtcRange(BranchTime.LocalDate(now, zone), BranchTime.LocalDate(now, zone), zone).FromUtc;
        try
        {
            var organizations = await db.Organizations.CountAsync(cancellationToken);
            var users = await db.Users.CountAsync(u => u.Status == UserStatus.Active, cancellationToken);
            var orders = await db.Orders.IgnoreQueryFilters().CountAsync(o => o.OpenedAt >= todayStart, cancellationToken);
            return new SystemInfoDto(Version, request.Environment, "ok", uptime, StartedAt, organizations, users, orders);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "System info: database check failed");
            return new SystemInfoDto(Version, request.Environment, "unavailable", uptime, StartedAt, 0, 0, 0);
        }
    }
}

/// <summary><c>GET /platform/system-events</c> — audit entries of platform actions and integration errors.</summary>
public sealed record ListSystemEventsQuery : AuditLogFilter;

public sealed class ListSystemEventsHandler(IApplicationDbContext db, AuditLogReader reader)
    : IHandler<ListSystemEventsQuery, PagedResult<AuditLogDto>>
{
    public async Task<Result<PagedResult<AuditLogDto>>> HandleAsync(ListSystemEventsQuery request, CancellationToken cancellationToken)
    {
        var events = db.AuditLogs.Where(a =>
            a.Action.StartsWith(PlatformActions.Prefix) || a.Action.StartsWith(PlatformActions.IntegrationPrefix));
        return await reader.PageAsync(reader.Apply(events, request), request, cancellationToken);
    }
}
