using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Application.Features.Reservations.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reservations.Availability;

/// <summary>Loads bookable tables and active reservations by EXPLICIT org/branch (used by staff and public endpoints).</summary>
[ScopedService]
public sealed class ReservationAvailabilityService(IApplicationDbContext db)
{
    public async Task<IReadOnlyList<AvailabilityTable>> TablesAsync(Guid organizationId, Guid branchId, CancellationToken ct) =>
        await db.DiningTables.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.OrganizationId == organizationId && t.BranchId == branchId && !t.IsArchived && t.IsActive
                        && t.Status != TableStatus.Unavailable && !t.DiningArea!.IsArchived)
            .Select(t => new AvailabilityTable(t.Id, t.Number, t.Capacity, t.DiningAreaId, t.DiningArea!.Name))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<BusyInterval>> BusyAsync(Guid organizationId, Guid branchId, DateTime fromUtc, DateTime toUtc, CancellationToken ct) =>
        await db.TableReservations.IgnoreQueryFilters().AsNoTracking()
            .Where(r => r.OrganizationId == organizationId && r.BranchId == branchId && r.TableId != null
                        && (r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.Seated)
                        && r.StartsAt < toUtc && fromUtc < r.EndsAt)
            .Select(r => new BusyInterval(r.TableId!.Value, r.StartsAt, r.EndsAt))
            .ToListAsync(ct);

    /// <summary>Slots of a branch-local day; busy reservations are loaded for the whole span the slots can touch.</summary>
    public async Task<IReadOnlyList<SlotAvailability>> SlotsAsync(
        Guid organizationId, Guid branchId, DateOnly date, TimeZoneInfo zone, SlotGrid grid, int guests, DateTime notBeforeUtc, CancellationToken ct)
    {
        var dayStart = TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zone);
        var spanEnd = dayStart.AddDays(1).AddMinutes(grid.DurationMinutes);
        var tables = await TablesAsync(organizationId, branchId, ct);
        var busy = await BusyAsync(organizationId, branchId, dayStart, spanEnd, ct);
        return AvailabilityCalculator.Calculate(date, zone, grid, guests, tables, busy, notBeforeUtc);
    }
}

/// <summary><c>GET /reservations/availability?date=&amp;guests=&amp;durationMinutes=&amp;slotMinutes=</c> (B) — free tables per slot.</summary>
public sealed record ReservationAvailabilityQuery
{
    public DateOnly Date { get; init; }
    public int Guests { get; init; } = 1;
    public int? DurationMinutes { get; init; }
    public int? SlotMinutes { get; init; }
}

public sealed class ReservationAvailabilityQueryValidator : AbstractValidator<ReservationAvailabilityQuery>
{
    public ReservationAvailabilityQueryValidator()
    {
        RuleFor(x => x.Date).NotEmpty();
        RuleFor(x => x.Guests).InclusiveBetween(1, ReservationLimits.MaxGuests);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(15, 720).When(x => x.DurationMinutes is not null);
        RuleFor(x => x.SlotMinutes).InclusiveBetween(5, 240).When(x => x.SlotMinutes is not null);
    }
}

public sealed record ReservationAvailabilityDto(
    DateOnly Date, string Timezone, int Guests, int DurationMinutes, IReadOnlyList<SlotAvailability> Slots);

public sealed class ReservationAvailabilityHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    ReservationAvailabilityService availability,
    IOptions<ReservationAvailabilityOptions> options,
    IClock clock)
    : IHandler<ReservationAvailabilityQuery, ReservationAvailabilityDto>
{
    public async Task<Result<ReservationAvailabilityDto>> HandleAsync(ReservationAvailabilityQuery request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var timezone = await db.Branches.Where(b => b.Id == branchId).Select(b => b.Timezone).FirstAsync(cancellationToken);
        var o = options.Value;
        var grid = new SlotGrid(o.Open, o.LastSlot, request.SlotMinutes ?? o.SlotMinutes, request.DurationMinutes ?? o.DurationMinutes);
        var slots = await availability.SlotsAsync(orgId, branchId, request.Date, BranchTimeService.Resolve(timezone), grid,
            request.Guests, clock.UtcNow, cancellationToken);
        return new ReservationAvailabilityDto(request.Date, timezone, request.Guests, grid.DurationMinutes, slots);
    }
}
