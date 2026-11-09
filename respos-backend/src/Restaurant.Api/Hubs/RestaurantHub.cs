using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Restaurant.Api.Middleware;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Constants;
using Restaurant.Infrastructure.Context;

namespace Restaurant.Api.Hubs;

/// <summary>
/// Realtime hub (/hubs/restaurant). Notification only — clients refetch from REST (REALTIME.md).
/// Every join validates branch access (and kitchen.read for kitchen groups) against the DB.
/// </summary>
[Authorize]
public sealed class RestaurantHub(
    RequestContext requestContext,
    IBranchAccessService branchAccess,
    IPermissionService permissions,
    IApplicationDbContext db) : Hub
{
    public override async Task OnConnectedAsync()
    {
        RequestContextMiddleware.Populate(requestContext, Context.User);
        if (requestContext.UserId is { } userId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, RealtimeGroups.User(userId));
        }

        await base.OnConnectedAsync();
    }

    public async Task JoinBranch(Guid branchId)
    {
        await EnsureBranchAccessAsync(branchId);
        await Groups.AddToGroupAsync(Context.ConnectionId, RealtimeGroups.Branch(branchId));
    }

    public async Task JoinKitchenStation(Guid branchId, Guid? stationId)
    {
        await EnsureKitchenAccessAsync(branchId, stationId);
        await Groups.AddToGroupAsync(Context.ConnectionId, KitchenGroup(branchId, stationId));
    }

    public Task LeaveKitchenStation(Guid branchId, Guid? stationId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, KitchenGroup(branchId, stationId));

    private static string KitchenGroup(Guid branchId, Guid? stationId) =>
        stationId is { } station ? RealtimeGroups.Station(branchId, station) : RealtimeGroups.Kitchen(branchId);

    private async Task<(Guid UserId, Guid OrganizationId)> EnsureBranchAccessAsync(Guid branchId)
    {
        RequestContextMiddleware.Populate(requestContext, Context.User);
        if (requestContext.UserId is not { } userId
            || requestContext.OrganizationId is not { } organizationId
            || !await branchAccess.HasAccessAsync(userId, organizationId, branchId, Context.ConnectionAborted))
        {
            throw new HubException("tenant.branch_forbidden");
        }

        return (userId, organizationId);
    }

    private async Task EnsureKitchenAccessAsync(Guid branchId, Guid? stationId)
    {
        var (userId, organizationId) = await EnsureBranchAccessAsync(branchId);
        var granted = await permissions.GetPermissionsAsync(userId, organizationId, Context.ConnectionAborted);
        if (!granted.Contains(Permissions.Kitchen.Read))
        {
            throw new HubException("auth.forbidden");
        }

        if (stationId is { } station
            && !await db.KitchenStations.IgnoreQueryFilters().AnyAsync(
                s => s.Id == station && s.BranchId == branchId && s.OrganizationId == organizationId, Context.ConnectionAborted))
        {
            throw new HubException("kitchen_station.not_found");
        }
    }
}
