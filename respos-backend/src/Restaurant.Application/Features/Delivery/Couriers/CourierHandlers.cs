using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Delivery.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;

namespace Restaurant.Application.Features.Delivery.Couriers;

public sealed record ListCouriersQuery(bool IncludeInactive);

public sealed record SaveCourierCommand(string Name, string Phone, bool IsActive = true)
{
    /// <summary>Route id for updates (empty for create).</summary>
    [JsonIgnore]
    public Guid Id { get; init; }
}

public sealed class SaveCourierValidator : AbstractValidator<SaveCourierCommand>
{
    public SaveCourierValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Phone).NormalizablePhone();
    }
}

/// <summary><c>GET /delivery/couriers</c>: couriers of the current branch (active first, then by name).</summary>
public sealed class ListCouriersHandler(IApplicationDbContext db, ITenantContext tenant) : IHandler<ListCouriersQuery, IReadOnlyList<CourierDto>>
{
    public async Task<Result<IReadOnlyList<CourierDto>>> HandleAsync(ListCouriersQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var couriers = await db.Couriers.AsNoTracking()
            .Where(c => c.BranchId == branchId && (request.IncludeInactive || c.IsActive))
            .OrderByDescending(c => c.IsActive).ThenBy(c => c.Name)
            .ToListAsync(cancellationToken);
        return couriers.Select(CourierDto.From).ToList();
    }
}

/// <summary><c>POST /delivery/couriers</c> (Id empty) and <c>PUT /delivery/couriers/{id}</c>.</summary>
public sealed class SaveCourierHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<SaveCourierCommand, CourierDto>
{
    public async Task<Result<CourierDto>> HandleAsync(SaveCourierCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        Courier? courier;
        if (request.Id == Guid.Empty)
        {
            courier = new Courier { BranchId = branchId };
            db.Couriers.Add(courier);
        }
        else
        {
            courier = await db.Couriers.FirstOrDefaultAsync(c => c.Id == request.Id && c.BranchId == branchId, cancellationToken);
            if (courier is null)
            {
                return DeliveryErrors.CourierNotFound;
            }
        }

        courier.Name = request.Name.Trim();
        courier.Phone = PhoneNumbers.Normalize(request.Phone)!;
        courier.IsActive = request.IsActive;
        audit.Log(new AuditEntry(request.Id == Guid.Empty ? "courier.created" : "courier.updated", "courier", courier.Id.ToString(),
            new { courier.Name, courier.Phone, courier.IsActive }) { BranchId = branchId });
        await db.SaveChangesAsync(cancellationToken);
        return CourierDto.From(courier);
    }
}
