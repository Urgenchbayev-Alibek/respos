using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Domain.Common;

namespace Restaurant.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Before save: stamps Created/Updated fields, fills OrganizationId of new tenant rows from the tenant context,
/// and refuses writes of tenant rows belonging to another organization than the current one.
/// </summary>
internal sealed class AuditableEntityInterceptor(ITenantContext tenant, IClock clock) : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        if (eventData.Context is { } context)
        {
            Apply(context);
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Apply(DbContext context)
    {
        var now = clock.UtcNow;
        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified))
            {
                continue;
            }

            if (entry.Entity is ITenantScoped scoped)
            {
                ApplyTenant(scoped, entry.State);
            }

            if (entry.Entity is IAuditable auditable)
            {
                ApplyAudit(auditable, entry.State, now);
            }
        }
    }

    private void ApplyTenant(ITenantScoped scoped, EntityState state)
    {
        if (state == EntityState.Added && scoped.OrganizationId == Guid.Empty)
        {
            scoped.OrganizationId = tenant.OrganizationId
                ?? throw new InvalidOperationException($"{scoped.GetType().Name} requires an organization context.");
        }

        if (tenant.OrganizationId is { } current && scoped.OrganizationId != current)
        {
            throw new InvalidOperationException($"Cross-tenant write of {scoped.GetType().Name} rejected.");
        }
    }

    private void ApplyAudit(IAuditable auditable, EntityState state, DateTime now)
    {
        if (state == EntityState.Added)
        {
            if (auditable.CreatedAt == default)
            {
                auditable.CreatedAt = now;
            }

            auditable.CreatedBy ??= tenant.UserId;
            return;
        }

        auditable.UpdatedAt = now;
        auditable.UpdatedBy = tenant.UserId;
    }
}
