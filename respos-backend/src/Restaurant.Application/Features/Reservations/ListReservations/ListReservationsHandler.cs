using System.Linq.Expressions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Application.Features.Reservations.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Reservations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reservations.ListReservations;

/// <summary>
/// <c>GET /reservations?date=&amp;from=&amp;to=&amp;status=&amp;tableId=&amp;search=</c>. <c>date</c> is a branch-local day;
/// <c>from</c>/<c>to</c> are UTC instants; a reservation matches when it overlaps the requested range.
/// </summary>
public sealed record ListReservationsQuery : PageQuery
{
    public DateOnly? Date { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    /// <summary>snake_case, comma list allowed (<c>confirmed,no_show</c>).</summary>
    public string? Status { get; init; }
    public Guid? TableId { get; init; }
}

public sealed class ListReservationsValidator : AbstractValidator<ListReservationsQuery>
{
    public ListReservationsValidator()
    {
        RuleFor(x => x.Status).Must(SnakeCaseEnum.IsValidListOrEmpty<ReservationStatus>).WithMessage("Unknown reservation status.");
    }
}

public sealed class ListReservationsHandler(IApplicationDbContext db, ITenantContext tenant, BranchTimeService branchTime)
    : IHandler<ListReservationsQuery, PagedResult<ReservationDto>>
{
    private static readonly Dictionary<string, Expression<Func<TableReservation, object>>> SortFields =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["startsAt"] = r => r.StartsAt,
            ["createdAt"] = r => r.CreatedAt,
            ["guestName"] = r => r.GuestName,
            ["status"] = r => r.Status,
        };

    public async Task<Result<PagedResult<ReservationDto>>> HandleAsync(ListReservationsQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var query = db.TableReservations.AsNoTracking().Where(r => r.BranchId == branchId);
        if (request.Date is { } date)
        {
            var (dayStart, dayEnd) = await branchTime.DayRangeUtcAsync(branchId, date, cancellationToken);
            query = query.Where(r => r.StartsAt < dayEnd && r.EndsAt > dayStart);
        }

        if (request.From is { } from)
        {
            var fromUtc = BranchTimeService.ToUtc(from);
            query = query.Where(r => r.EndsAt > fromUtc);
        }

        if (request.To is { } to)
        {
            var toUtc = BranchTimeService.ToUtc(to);
            query = query.Where(r => r.StartsAt < toUtc);
        }

        var statuses = SnakeCaseEnum.ParseList<ReservationStatus>(request.Status);
        if (statuses.Count > 0)
        {
            query = query.Where(r => statuses.Contains(r.Status));
        }

        if (request.TableId is { } tableId)
        {
            query = query.Where(r => r.TableId == tableId);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(r => r.GuestName.ToLower().Contains(term) || r.GuestPhone.Contains(term));
        }

        var page = await query.ApplySort(request, SortFields, r => r.StartsAt).ToPagedResultAsync(request, cancellationToken);
        var tableIds = page.Items.Where(r => r.TableId != null).Select(r => r.TableId!.Value).Distinct().ToList();
        var numbers = await db.DiningTables.AsNoTracking().Where(t => tableIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Number, cancellationToken);
        var items = page.Items
            .Select(r => ReservationDto.From(r, r.TableId is { } id ? numbers.GetValueOrDefault(id) : null))
            .ToList();
        return new PagedResult<ReservationDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}
