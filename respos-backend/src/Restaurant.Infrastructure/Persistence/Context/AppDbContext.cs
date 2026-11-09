using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Infrastructure.Persistence.DomainEvents;
using Restaurant.Infrastructure.Realtime;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>
/// EF Core context. DbSets live in one partial file per module (AppDbContext.{Module}.cs);
/// configurations are discovered with ApplyConfigurationsFromAssembly; tenant filters/conventions in AppDbContext.Model.cs.
/// SaveChangesAsync pipeline: dispatch domain events (same UoW) → interceptors stamp audit/tenant → commit → flush realtime.
/// </summary>
public sealed partial class AppDbContext : DbContext, IApplicationDbContext
{
    private const int MaxDomainEventRounds = 10;

    private readonly ITenantContext _tenant;
    private readonly IDomainEventDispatcher? _dispatcher;
    private readonly IRealtimeFlusher? _realtimeFlusher;
    private bool _isSaving;

    public AppDbContext(
        DbContextOptions<AppDbContext> options,
        ITenantContext tenant,
        IDomainEventDispatcher? dispatcher = null,
        IRealtimeFlusher? realtimeFlusher = null)
        : base(options)
    {
        _tenant = tenant;
        _dispatcher = dispatcher;
        _realtimeFlusher = realtimeFlusher;
    }

    /// <summary>Evaluated per query by the global tenant filter.</summary>
    internal Guid? CurrentOrganizationId => _tenant.OrganizationId;

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        if (_isSaving)
        {
            throw new InvalidOperationException(
                "SaveChangesAsync was called re-entrantly (e.g. from a domain event handler). Handlers must not save.");
        }

        _isSaving = true;
        try
        {
            await DispatchDomainEventsAsync(cancellationToken);
            var result = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            if (Database.CurrentTransaction is null && _realtimeFlusher is not null)
            {
                await _realtimeFlusher.FlushAsync(cancellationToken);
            }

            return result;
        }
        finally
        {
            _isSaving = false;
        }
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess) =>
        throw new NotSupportedException("Use SaveChangesAsync.");

    public async Task<T> ExecuteInTransactionAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken = default)
    {
        if (Database.CurrentTransaction is not null)
        {
            return await operation(cancellationToken);
        }

        T result;
        await using (var transaction = await Database.BeginTransactionAsync(cancellationToken))
        {
            result = await operation(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        if (_realtimeFlusher is not null)
        {
            await _realtimeFlusher.FlushAsync(cancellationToken);
        }

        return result;
    }

    private async Task DispatchDomainEventsAsync(CancellationToken cancellationToken)
    {
        if (_dispatcher is null)
        {
            return;
        }

        for (var round = 0; round < MaxDomainEventRounds; round++)
        {
            var dispatched = await _dispatcher.DispatchPendingAsync(this, cancellationToken);
            if (dispatched == 0)
            {
                return;
            }
        }

        throw new InvalidOperationException("Domain event handlers keep raising events (possible cycle).");
    }
}
