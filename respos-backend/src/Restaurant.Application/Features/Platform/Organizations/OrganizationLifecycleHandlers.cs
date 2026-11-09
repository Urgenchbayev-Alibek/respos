using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Saas;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Platform.Organizations;

public sealed record ChangeOrganizationStatusCommand(Guid Id, bool Activate);

/// <summary>
/// <c>POST /platform/organizations/{id}/suspend|activate</c>. A suspended organization's members cannot sign in
/// (<c>organization.suspended</c>) and lose all org permissions immediately (permissions are loaded per request).
/// </summary>
public sealed class ChangeOrganizationStatusHandler(IApplicationDbContext db, IAuditLogger audit)
    : IHandler<ChangeOrganizationStatusCommand, PlatformOrganizationDto>
{
    public async Task<Result<PlatformOrganizationDto>> HandleAsync(ChangeOrganizationStatusCommand request, CancellationToken cancellationToken)
    {
        var organization = await db.Organizations.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
        if (organization is null)
        {
            return OrganizationErrors.NotFound;
        }

        var target = request.Activate ? OrganizationStatus.Active : OrganizationStatus.Suspended;
        if (organization.Status != target)
        {
            var previous = organization.Status;
            organization.Status = target;
            var action = request.Activate ? PlatformActions.OrganizationActivated : PlatformActions.OrganizationSuspended;
            audit.Log(new AuditEntry(action, nameof(Organization), organization.Id.ToString(), new { From = previous, To = target })
            {
                OrganizationId = organization.Id,
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        return await db.ProjectOrganizations(db.Organizations.Where(o => o.Id == organization.Id)).FirstAsync(cancellationToken);
    }
}

public sealed record UpdateSubscriptionCommand(string PlanCode, SubscriptionStatus Status, DateTime? EndsAt)
{
    public Guid OrganizationId { get; init; }
}

public sealed class UpdateSubscriptionValidator : AbstractValidator<UpdateSubscriptionCommand>
{
    public UpdateSubscriptionValidator()
    {
        RuleFor(x => x.PlanCode).NotEmpty().MaximumLength(32);
        RuleFor(x => x.Status).IsInEnum();
    }
}

/// <summary><c>PUT /platform/organizations/{id}/subscription</c> — manual plan assignment (no billing in MVP). Audited.</summary>
public sealed class UpdateSubscriptionHandler(IApplicationDbContext db, IAuditLogger audit, IClock clock)
    : IHandler<UpdateSubscriptionCommand, PlatformOrganizationDto>
{
    public async Task<Result<PlatformOrganizationDto>> HandleAsync(UpdateSubscriptionCommand request, CancellationToken cancellationToken)
    {
        if (!await db.Organizations.AnyAsync(o => o.Id == request.OrganizationId, cancellationToken))
        {
            return OrganizationErrors.NotFound;
        }

        var plan = await db.Plans.FirstOrDefaultAsync(p => p.Code == request.PlanCode, cancellationToken);
        if (plan is null)
        {
            return PlatformErrors.PlanNotFound;
        }

        var subscription = await db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.OrganizationId == request.OrganizationId)
            .OrderByDescending(s => s.StartsAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (subscription is null)
        {
            subscription = new Subscription { OrganizationId = request.OrganizationId, StartsAt = clock.UtcNow };
            db.Subscriptions.Add(subscription);
        }

        subscription.PlanId = plan.Id;
        subscription.Status = request.Status;
        subscription.EndsAt = request.EndsAt is { } endsAt ? DateTime.SpecifyKind(endsAt.ToUniversalTime(), DateTimeKind.Utc) : null;
        audit.Log(new AuditEntry(PlatformActions.SubscriptionUpdated, nameof(Subscription), subscription.Id.ToString(),
            new { request.PlanCode, request.Status, subscription.EndsAt })
        {
            OrganizationId = request.OrganizationId,
        });
        await db.SaveChangesAsync(cancellationToken);

        return await db.ProjectOrganizations(db.Organizations.Where(o => o.Id == request.OrganizationId)).FirstAsync(cancellationToken);
    }
}
