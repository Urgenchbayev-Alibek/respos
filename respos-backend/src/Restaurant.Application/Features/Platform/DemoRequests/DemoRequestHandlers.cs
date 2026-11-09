using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Saas;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Platform.DemoRequests;

public sealed record DemoRequestDto(
    Guid Id, string Name, string Phone, string? Email, string RestaurantName, string? City, string? Message,
    DemoRequestStatus Status, DateTime CreatedAt);

/// <summary><c>GET /platform/demo-requests?status=&amp;search=&amp;page=&amp;pageSize=</c> — newest first.</summary>
public sealed record ListDemoRequestsQuery : PageQuery
{
    public DemoRequestStatus? Status { get; init; }
}

public sealed class ListDemoRequestsHandler(IApplicationDbContext db) : IHandler<ListDemoRequestsQuery, PagedResult<DemoRequestDto>>
{
    public async Task<Result<PagedResult<DemoRequestDto>>> HandleAsync(ListDemoRequestsQuery request, CancellationToken cancellationToken)
    {
        var query = db.DemoRequests.AsNoTracking();
        if (request.Status is { } status)
        {
            query = query.Where(d => d.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(d => d.Name.ToLower().Contains(term) || d.RestaurantName.ToLower().Contains(term) || d.Phone.Contains(term));
        }

        return await query.OrderByDescending(d => d.CreatedAt).ThenByDescending(d => d.Id)
            .Select(d => new DemoRequestDto(d.Id, d.Name, d.Phone, d.Email, d.RestaurantName, d.City, d.Message, d.Status, d.CreatedAt))
            .ToPagedResultAsync(request, cancellationToken);
    }
}

public sealed record ChangeDemoRequestStatusCommand(DemoRequestStatus Status)
{
    public Guid Id { get; init; }
}

public sealed class ChangeDemoRequestStatusValidator : AbstractValidator<ChangeDemoRequestStatusCommand>
{
    public ChangeDemoRequestStatusValidator() => RuleFor(x => x.Status).IsInEnum();
}

/// <summary><c>POST /platform/demo-requests/{id}/status { status }</c>. Audited.</summary>
public sealed class ChangeDemoRequestStatusHandler(IApplicationDbContext db, IAuditLogger audit)
    : IHandler<ChangeDemoRequestStatusCommand, DemoRequestDto>
{
    public async Task<Result<DemoRequestDto>> HandleAsync(ChangeDemoRequestStatusCommand request, CancellationToken cancellationToken)
    {
        var demo = await db.DemoRequests.FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken);
        if (demo is null)
        {
            return PlatformErrors.DemoRequestNotFound;
        }

        if (demo.Status != request.Status)
        {
            audit.Log(PlatformActions.DemoRequestStatusChanged, nameof(DemoRequest), demo.Id, new { From = demo.Status, To = request.Status });
            demo.Status = request.Status;
            await db.SaveChangesAsync(cancellationToken);
        }

        return new DemoRequestDto(
            demo.Id, demo.Name, demo.Phone, demo.Email, demo.RestaurantName, demo.City, demo.Message, demo.Status, demo.CreatedAt);
    }
}
