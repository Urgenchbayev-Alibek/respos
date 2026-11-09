using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Notifications;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Notifications module DbSets (implements IApplicationDbContext.Notifications.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationRead> NotificationReads => Set<NotificationRead>();
}
