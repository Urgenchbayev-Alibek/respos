using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Notifications;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Application.Features.Integrations.Alerts;
using Restaurant.Application.Features.Reservations.Availability;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Reservations;
using Restaurant.Domain.Enums;
using static System.FormattableString;

namespace Restaurant.Application.Features.Public.Reservations;

/// <summary>Anonymous booking context: active branch of an active organization (else 404 <c>branch.not_found</c>).</summary>
[ScopedService]
public sealed class PublicBookingContext(IApplicationDbContext db, IOptions<ReservationAvailabilityOptions> options, IClock clock)
{
    public ReservationAvailabilityOptions Options => options.Value;

    public SlotGrid Grid => new(Options.Open, Options.LastSlot, Options.SlotMinutes, Options.DurationMinutes);

    public DateTime NotBeforeUtc => clock.UtcNow.AddMinutes(Options.MinLeadMinutes);

    public async Task<RestaurantBranch?> FindBranchAsync(string branchSlug, CancellationToken ct)
    {
        var slug = branchSlug.Trim().ToLowerInvariant();
        return await db.Branches.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(b => b.Slug == slug && b.IsActive && b.Organization!.Status == OrganizationStatus.Active, ct);
    }

    /// <summary>Date must be between branch-local today and today + MaxDaysAhead.</summary>
    public bool IsBookableDate(DateOnly date, TimeZoneInfo zone)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(clock.UtcNow, zone));
        return date >= today && date <= today.AddDays(Options.MaxDaysAhead);
    }
}

public sealed class PublicAvailabilityHandler(PublicBookingContext booking, ReservationAvailabilityService availability)
    : IHandler<PublicAvailabilityQuery, PublicAvailabilityDto>
{
    public async Task<Result<PublicAvailabilityDto>> HandleAsync(PublicAvailabilityQuery request, CancellationToken cancellationToken)
    {
        var branch = await booking.FindBranchAsync(request.BranchSlug, cancellationToken);
        if (branch is null)
        {
            return BranchErrors.NotFound;
        }

        var zone = BranchTimeService.Resolve(branch.Timezone);
        if (!booking.IsBookableDate(request.Date, zone))
        {
            return PublicReservationErrors.InvalidDate;
        }

        var slots = request.Guests > booking.Options.MaxOnlineGuests
            ? []
            : await availability.SlotsAsync(branch.OrganizationId, branch.Id, request.Date, zone, booking.Grid, request.Guests,
                booking.NotBeforeUtc, cancellationToken);
        return new PublicAvailabilityDto(branch.Slug!, branch.Name, request.Date, branch.Timezone, booking.Grid.DurationMinutes,
            booking.Options.MaxOnlineGuests, slots.Select(s => new PublicSlotDto(s.Time, s.StartsAt, s.FreeTables.Count > 0)).ToList());
    }
}

/// <summary>
/// Creates a <c>pending</c> reservation on the smallest free table that fits (serialized per branch with an advisory
/// lock), then notifies staff (in-app, <c>reservations.read</c>) and the owner (Telegram <c>online_reservation</c>).
/// </summary>
public sealed class CreatePublicReservationHandler(
    IApplicationDbContext db,
    IAdvisoryLock locks,
    PublicBookingContext booking,
    ReservationAvailabilityService availability,
    INotificationPublisher notifications,
    OwnerAlerts alerts,
    IAuditLogger audit)
    : IHandler<CreatePublicReservationCommand, PublicReservationCreatedDto>
{
    public const string LockScope = "reservations";

    public async Task<Result<PublicReservationCreatedDto>> HandleAsync(CreatePublicReservationCommand request, CancellationToken cancellationToken)
    {
        var branch = await booking.FindBranchAsync(request.BranchSlug, cancellationToken);
        if (branch is null)
        {
            return BranchErrors.NotFound;
        }

        var zone = BranchTimeService.Resolve(branch.Timezone);
        var time = request.LocalTime!.Value;
        if (!booking.IsBookableDate(request.Date, zone))
        {
            return PublicReservationErrors.InvalidDate;
        }

        var grid = booking.Grid;
        var start = TimeZoneInfo.ConvertTimeToUtc(request.Date.ToDateTime(time, DateTimeKind.Unspecified), zone);
        if (!AvailabilityCalculator.SlotTimes(grid).Contains(time) || start < booking.NotBeforeUtc)
        {
            return PublicReservationErrors.InvalidTime;
        }

        if (request.Guests > booking.Options.MaxOnlineGuests)
        {
            return PublicReservationErrors.TooManyGuests;
        }

        var end = start.AddMinutes(grid.DurationMinutes);
        if (!string.IsNullOrWhiteSpace(request.Website))
        {
            // Honeypot: same answer as a success, nothing stored or sent.
            return new PublicReservationCreatedDto(Guid.NewGuid(), ReservationStatus.Pending, start, end, request.Guests, branch.Name);
        }

        return await db.ExecuteInTransactionAsync(ct => BookAsync(branch, request, start, end, zone, ct), cancellationToken);
    }

    private async Task<Result<PublicReservationCreatedDto>> BookAsync(
        RestaurantBranch branch, CreatePublicReservationCommand request, DateTime start, DateTime end, TimeZoneInfo zone, CancellationToken ct)
    {
        await locks.AcquireAsync(LockScope, branch.Id, ct);
        var tables = await availability.TablesAsync(branch.OrganizationId, branch.Id, ct);
        var busy = (await availability.BusyAsync(branch.OrganizationId, branch.Id, start, end, ct)).ToLookup(b => b.TableId);
        var table = tables.Where(t => t.Capacity >= request.Guests)
            .OrderBy(t => t.Capacity).ThenBy(t => t.Number, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(t => AvailabilityCalculator.IsFree(busy[t.Id], start, end));
        if (table is null)
        {
            return PublicReservationErrors.SlotUnavailable;
        }

        var reservation = new TableReservation
        {
            OrganizationId = branch.OrganizationId,
            BranchId = branch.Id,
            TableId = table.Id,
            GuestName = request.Name.Trim(),
            GuestPhone = PhoneNumbers.Normalize(request.Phone)!,
            GuestCount = request.Guests,
            StartsAt = start,
            EndsAt = end,
            Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(),
            Status = ReservationStatus.Pending,
        };
        db.TableReservations.Add(reservation);
        await NotifyAsync(branch, reservation, table, zone, ct);
        audit.Log(new AuditEntry("reservation.created_online", nameof(TableReservation), reservation.Id.ToString(),
            new { reservation.GuestCount, reservation.StartsAt, reservation.EndsAt, tableId = table.Id })
        {
            OrganizationId = branch.OrganizationId,
            BranchId = branch.Id,
        });
        await db.SaveChangesAsync(ct);
        return new PublicReservationCreatedDto(reservation.Id, reservation.Status, start, end, reservation.GuestCount, branch.Name);
    }

    private async Task NotifyAsync(RestaurantBranch branch, TableReservation r, AvailabilityTable table, TimeZoneInfo zone, CancellationToken ct)
    {
        var when = AlertFormat.LocalTime(r.StartsAt, zone);
        var summary = Invariant($"{r.GuestName}, гостей: {r.GuestCount}, {when}, стол {table.Number}");
        await notifications.PublishToPermissionAsync(
            new NotificationMessage(branch.OrganizationId, branch.Id, NotificationType.System, "Новая онлайн-бронь", summary, "/admin/reservations"),
            Permissions.Reservations.Read, null, ct);
        var text = $"📅 Новая онлайн-бронь — {branch.Name}\n{summary}\nТелефон: {r.GuestPhone}"
                   + (r.Comment is null ? string.Empty : $"\nКомментарий: {r.Comment}");
        await alerts.TelegramAsync(branch.OrganizationId, branch.Id, AlertKinds.OnlineReservation, c => c.OnlineReservationEnabled,
            $"Онлайн-бронь: {when}", text, ct);
    }
}
