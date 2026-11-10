using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Integrations;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Integrations DbSets (F7).</summary>
public partial interface IApplicationDbContext
{
    DbSet<IntegrationSetting> IntegrationSettings { get; }
    DbSet<OutboundMessage> OutboundMessages { get; }
    DbSet<IntegrationErrorLog> IntegrationErrorLogs { get; }
}
