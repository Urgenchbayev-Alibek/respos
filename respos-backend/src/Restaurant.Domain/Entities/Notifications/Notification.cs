using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Notifications;

/// <summary>UserId null = visible to all users with the relevant permission in the branch/org.</summary>
public class Notification : Entity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? UserId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? Link { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<NotificationRead> Reads { get; set; } = [];
}

/// <summary>Per-user read state (composite key NotificationId + UserId).</summary>
public class NotificationRead
{
    public Guid NotificationId { get; set; }
    public Guid UserId { get; set; }
    public DateTime ReadAt { get; set; }
}
