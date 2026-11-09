using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Notifications;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Notifications DbSets.</summary>
public partial interface IApplicationDbContext
{
    DbSet<Notification> Notifications { get; }
    DbSet<NotificationRead> NotificationReads { get; }
}
