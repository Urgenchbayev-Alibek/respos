using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Integrations;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Integrations DbSets (implements IApplicationDbContext.Integrations.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<IntegrationSetting> IntegrationSettings => Set<IntegrationSetting>();
    public DbSet<OutboundMessage> OutboundMessages => Set<OutboundMessage>();
    public DbSet<IntegrationErrorLog> IntegrationErrorLogs => Set<IntegrationErrorLog>();
}
