using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reservations.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Reservations;

namespace Restaurant.Application.Features.Reservations.ReservationActions;

public enum ReservationAction { Confirm, Seat, Complete, Cancel, NoShow }

public sealed record ReservationActionCommand(Guid ReservationId, ReservationAction Action, string? Reason = null);

/// <summary>Body of <c>POST /reservations/{id}/cancel</c>.</summary>
public sealed record CancelReservationRequest(string? Reason);

public sealed class CancelReservationRequestValidator : AbstractValidator<CancelReservationRequest>
{
    public CancelReservationRequestValidator() =>
        RuleFor(x => x.Reason).MaximumLength(ReservationLimits.ReasonMaxLength);
}

/// <summary>
/// Status transitions (BR-5.1, invalid → 409 reservation.invalid_status_transition) and their table effects
/// (DECISIONS_v1_1 item 12): seat → table occupied; complete/no-show/cancel → table available if no active order.
/// </summary>
public sealed class ReservationActionHandler(
    IApplicationDbContext db, ITenantContext tenant, ReservationService reservations, IAuditLogger audit)
    : IHandler<ReservationActionCommand, ReservationDto>
{
    public async Task<Result<ReservationDto>> HandleAsync(ReservationActionCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var reservation = await db.TableReservations
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId && r.BranchId == branchId, cancellationToken);
        if (reservation is null)
        {
            return ReservationRules.NotFound;
        }

        var previous = reservation.Status;
        switch (request.Action)
        {
            case ReservationAction.Confirm:
                reservation.Confirm();
                break;
            case ReservationAction.Seat:
                reservation.Seat();
                await reservations.OccupyTableAsync(reservation, cancellationToken);
                break;
            case ReservationAction.Complete:
                reservation.Complete();
                await reservations.ReleaseTableAsync(reservation, cancellationToken);
                break;
            case ReservationAction.Cancel:
                reservation.Cancel(request.Reason);
                await reservations.ReleaseTableAsync(reservation, cancellationToken);
                break;
            case ReservationAction.NoShow:
                reservation.MarkNoShow();
                await reservations.ReleaseTableAsync(reservation, cancellationToken);
                break;
        }

        audit.Log("reservation.status_changed", nameof(TableReservation), reservation.Id,
            new { from = previous, to = reservation.Status, reason = reservation.CancelReason });
        await db.SaveChangesAsync(cancellationToken);
        return ReservationDto.From(reservation, await reservations.TableNumberAsync(reservation.TableId, cancellationToken));
    }
}
