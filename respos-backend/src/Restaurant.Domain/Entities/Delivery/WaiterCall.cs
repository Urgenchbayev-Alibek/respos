using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Delivery;

/// <summary>"Call waiter" / "bring the bill" pressed by a guest on the public QR menu of a table.</summary>
public class WaiterCall : Entity, IBranchScoped
{
    private WaiterCall()
    {
    }

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; private set; }
    public Guid TableId { get; private set; }
    public string TableNumber { get; private set; } = string.Empty;
    public WaiterCallReason Reason { get; private set; }
    public WaiterCallStatus Status { get; private set; } = WaiterCallStatus.Active;
    public DateTime CreatedAt { get; private set; }
    public DateTime? AcknowledgedAt { get; private set; }
    public Guid? AcknowledgedBy { get; private set; }

    public static WaiterCall Create(Guid organizationId, Guid branchId, Guid tableId, string tableNumber, WaiterCallReason reason, DateTime utcNow) =>
        new()
        {
            OrganizationId = organizationId,
            BranchId = branchId,
            TableId = tableId,
            TableNumber = tableNumber,
            Reason = reason,
            CreatedAt = utcNow,
        };

    /// <summary>Idempotent: acknowledging an acknowledged call keeps the first stamp.</summary>
    public void Acknowledge(Guid userId, DateTime utcNow)
    {
        if (Status == WaiterCallStatus.Acknowledged)
        {
            return;
        }

        Status = WaiterCallStatus.Acknowledged;
        AcknowledgedAt = utcNow;
        AcknowledgedBy = userId;
    }
}
