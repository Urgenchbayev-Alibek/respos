using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Reservations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reservations.Common;

/// <summary>Reservation rules that need the database: table lookup, overlap check, table status effects.</summary>
[ScopedService]
public sealed class ReservationService(IApplicationDbContext db, TableReadService tables, IRealtimeNotifier realtime, IClock clock)
{
    /// <summary>Table of the branch that can take reservations (404 other branch/tenant, 409 archived).</summary>
    public async Task<Result<DiningTable>> FindBookableTableAsync(Guid branchId, Guid tableId, CancellationToken cancellationToken)
    {
        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == tableId && t.BranchId == branchId, cancellationToken);
        if (table is null)
        {
            return FloorErrors.TableNotFound;
        }

        return table.IsArchived ? FloorErrors.TableArchived : table;
    }

    public async Task<Result> ValidateAreaAsync(Guid branchId, Guid? areaId, CancellationToken cancellationToken)
    {
        if (areaId is not { } id)
        {
            return Result.Success();
        }

        var exists = await db.DiningAreas.AnyAsync(a => a.Id == id && a.BranchId == branchId && !a.IsArchived, cancellationToken);
        return exists ? Result.Success() : Result.Failure(FloorErrors.AreaNotFound);
    }

    /// <summary>BR-5.2: active reservations of one table must not overlap on [start, end).</summary>
    public async Task<bool> HasConflictAsync(
        Guid branchId, Guid tableId, DateTime start, DateTime end, Guid? excludeId, CancellationToken cancellationToken) =>
        await db.TableReservations.AnyAsync(
            r => r.BranchId == branchId && r.TableId == tableId && r.Id != excludeId
                 && (r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.Seated)
                 && r.StartsAt < end && start < r.EndsAt,
            cancellationToken);

    /// <summary>Seat → table occupied (DECISIONS_v1_1 item 12).</summary>
    public async Task OccupyTableAsync(TableReservation reservation, CancellationToken cancellationToken)
    {
        var table = await db.DiningTables.FirstAsync(t => t.Id == reservation.TableId && t.BranchId == reservation.BranchId, cancellationToken);
        if (table.Occupy())
        {
            Notify(table);
        }
    }

    /// <summary>Complete / no-show / cancel → table available unless an order is active on it.</summary>
    public async Task ReleaseTableAsync(TableReservation reservation, CancellationToken cancellationToken)
    {
        if (reservation.TableId is not { } tableId)
        {
            return;
        }

        var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == tableId && t.BranchId == reservation.BranchId, cancellationToken);
        if (table is null || table.IsArchived)
        {
            return;
        }

        if (table.ReleaseIfIdle(await tables.HasActiveOrderAsync(table, cancellationToken)))
        {
            Notify(table);
        }
    }

    public async Task<string?> TableNumberAsync(Guid? tableId, CancellationToken cancellationToken) =>
        tableId is { } id
            ? await db.DiningTables.Where(t => t.Id == id).Select(t => t.Number).FirstOrDefaultAsync(cancellationToken)
            : null;

    private void Notify(DiningTable table) =>
        realtime.ToBranch(table.BranchId, RealtimeEvents.TableUpdated, TableEvents.Payload(table, clock.UtcNow));
}
