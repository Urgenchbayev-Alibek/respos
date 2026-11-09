using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Application.Features.Reservations.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Reservations;

namespace Restaurant.Application.Features.Reservations.SaveReservation;

public sealed record SaveReservationCommand(
    Guid? TableId,
    Guid? PreferredAreaId,
    string GuestName,
    string GuestPhone,
    int GuestCount,
    DateTime StartsAt,
    DateTime EndsAt,
    string? Comment)
{
    /// <summary>Null = create.</summary>
    public Guid? Id { get; init; }
}

public sealed class SaveReservationValidator : AbstractValidator<SaveReservationCommand>
{
    public SaveReservationValidator()
    {
        RuleFor(x => x.GuestName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.GuestPhone).NotEmpty().ValidPhone();
        RuleFor(x => x.GuestCount).InclusiveBetween(1, ReservationLimits.MaxGuests);
        RuleFor(x => x.Comment).MaximumLength(ReservationLimits.CommentMaxLength);
        RuleFor(x => x.StartsAt).NotEmpty();
        RuleFor(x => x.EndsAt).NotEmpty();
    }
}

/// <summary>
/// Creates (status pending) or edits a pending/confirmed reservation. EndsAt &gt; StartsAt (400 reservation.invalid_period);
/// overlapping active reservation on the same table → 409 reservation.time_conflict.
/// </summary>
public sealed class SaveReservationHandler(
    IApplicationDbContext db, ITenantContext tenant, ReservationService reservations, IAuditLogger audit)
    : IHandler<SaveReservationCommand, ReservationDto>
{
    public async Task<Result<ReservationDto>> HandleAsync(SaveReservationCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var start = BranchTimeService.ToUtc(request.StartsAt);
        var end = BranchTimeService.ToUtc(request.EndsAt);
        var period = ReservationRules.ValidatePeriod(start, end);
        if (period.IsFailure)
        {
            return period.Error;
        }

        TableReservation reservation;
        if (request.Id is { } id)
        {
            var existing = await db.TableReservations.FirstOrDefaultAsync(r => r.Id == id && r.BranchId == branchId, cancellationToken);
            if (existing is null)
            {
                return ReservationRules.NotFound;
            }

            existing.EnsureEditable();
            reservation = existing;
        }
        else
        {
            reservation = new TableReservation { BranchId = branchId };
        }

        string? tableNumber = null;
        if (request.TableId is { } tableId)
        {
            var table = await reservations.FindBookableTableAsync(branchId, tableId, cancellationToken);
            if (table.IsFailure)
            {
                return table.Error;
            }

            if (await reservations.HasConflictAsync(branchId, tableId, start, end, request.Id, cancellationToken))
            {
                return ReservationRules.TimeConflict;
            }

            tableNumber = table.Value.Number;
        }

        var area = await reservations.ValidateAreaAsync(branchId, request.PreferredAreaId, cancellationToken);
        if (area.IsFailure)
        {
            return area.Error;
        }

        reservation.TableId = request.TableId;
        reservation.PreferredAreaId = request.PreferredAreaId;
        reservation.GuestName = request.GuestName.Trim();
        reservation.GuestPhone = request.GuestPhone.Trim();
        reservation.GuestCount = request.GuestCount;
        reservation.StartsAt = start;
        reservation.EndsAt = end;
        reservation.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        if (request.Id is null)
        {
            db.TableReservations.Add(reservation);
        }

        audit.Log(request.Id is null ? "reservation.created" : "reservation.updated", nameof(TableReservation), reservation.Id,
            new { reservation.TableId, reservation.StartsAt, reservation.EndsAt, reservation.GuestCount });
        await db.SaveChangesAsync(cancellationToken);
        return ReservationDto.From(reservation, tableNumber);
    }
}
