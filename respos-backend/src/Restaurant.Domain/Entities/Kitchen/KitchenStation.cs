using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Kitchen;

public class KitchenStation : AuditableEntity, IBranchScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        IsActive = false;
        ArchivedAt = utcNow;
    }
}

/// <summary>One ticket per station per "send to kitchen". Behaviour is added by the Kitchen module.</summary>
public partial class KitchenTicket : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid OrderId { get; set; }
    public Guid KitchenStationId { get; set; }
    public int Number { get; set; }
    public KitchenTicketStatus Status { get; set; } = KitchenTicketStatus.New;
    public DateTime? StartedAt { get; set; }
    public DateTime? ReadyAt { get; set; }

    public KitchenStation? KitchenStation { get; set; }
    public ICollection<KitchenTicketItem> Items { get; set; } = [];
}

public class KitchenTicketItem : Entity
{
    public Guid TicketId { get; set; }
    public Guid OrderItemId { get; set; }
    public KitchenTicketItemStatus Status { get; set; } = KitchenTicketItemStatus.New;

    public KitchenTicket? Ticket { get; set; }
}
