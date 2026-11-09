using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.KitchenStations;

public sealed record KitchenStationDto(Guid Id, string Name, int SortOrder, bool IsActive)
{
    public static KitchenStationDto From(KitchenStation s) => new(s.Id, s.Name, s.SortOrder, s.IsActive);
}

public sealed record ListKitchenStationsQuery;

public sealed record SaveKitchenStationCommand(string Name, int? SortOrder, bool? IsActive)
{
    /// <summary>Null = create.</summary>
    public Guid? Id { get; init; }
}

public sealed record ArchiveKitchenStationCommand(Guid Id);

public sealed class SaveKitchenStationValidator : AbstractValidator<SaveKitchenStationCommand>
{
    public SaveKitchenStationValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}

/// <summary>Non-archived stations of the current branch ordered by SortOrder (first = default station).</summary>
public sealed class ListKitchenStationsHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListKitchenStationsQuery, IReadOnlyList<KitchenStationDto>>
{
    public async Task<Result<IReadOnlyList<KitchenStationDto>>> HandleAsync(ListKitchenStationsQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        return await db.KitchenStations.AsNoTracking()
            .Where(s => s.BranchId == branchId && !s.IsArchived)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new KitchenStationDto(s.Id, s.Name, s.SortOrder, s.IsActive))
            .ToListAsync(cancellationToken);
    }
}

public sealed class SaveKitchenStationHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<SaveKitchenStationCommand, KitchenStationDto>
{
    public async Task<Result<KitchenStationDto>> HandleAsync(SaveKitchenStationCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        KitchenStation station;
        if (request.Id is { } id)
        {
            var existing = await db.KitchenStations
                .FirstOrDefaultAsync(s => s.Id == id && s.BranchId == branchId && !s.IsArchived, cancellationToken);
            if (existing is null)
            {
                return MenuErrors.StationNotFound;
            }

            station = existing;
        }
        else
        {
            var nextSort = await db.KitchenStations.Where(s => s.BranchId == branchId)
                .Select(s => (int?)s.SortOrder).MaxAsync(cancellationToken) ?? -1;
            station = new KitchenStation { BranchId = branchId, SortOrder = nextSort + 1 };
            db.KitchenStations.Add(station);
        }

        station.Name = request.Name.Trim();
        station.SortOrder = request.SortOrder ?? station.SortOrder;
        station.IsActive = request.IsActive ?? station.IsActive;
        audit.Log(request.Id is null ? "kitchen_station.created" : "kitchen_station.updated", nameof(KitchenStation), station.Id, request);
        await db.SaveChangesAsync(cancellationToken);
        return KitchenStationDto.From(station);
    }
}

/// <summary>DELETE = archive. Refused (409 kitchen_station.in_use) while non-archived menu items route to it.</summary>
public sealed class ArchiveKitchenStationHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit)
    : IHandler<ArchiveKitchenStationCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ArchiveKitchenStationCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var station = await db.KitchenStations.FirstOrDefaultAsync(s => s.Id == request.Id && s.BranchId == branchId, cancellationToken);
        if (station is null)
        {
            return MenuErrors.StationNotFound;
        }

        if (station.IsArchived)
        {
            return Unit.Value;
        }

        if (await db.MenuItems.AnyAsync(i => i.KitchenStationId == station.Id && !i.IsArchived, cancellationToken))
        {
            return MenuErrors.StationInUse;
        }

        station.Archive(clock.UtcNow);
        audit.Log("kitchen_station.archived", nameof(KitchenStation), station.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
