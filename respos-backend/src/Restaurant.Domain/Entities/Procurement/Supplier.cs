using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Procurement;

public class Supplier : AuditableEntity, ITenantScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Inn { get; set; }
    public string? Notes { get; set; }
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        ArchivedAt = utcNow;
    }
}

public partial class PurchaseOrder : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid SupplierId { get; set; }
    public int Number { get; set; }
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;
    public DateTime? ExpectedAt { get; set; }
    public decimal Total { get; set; }
    public string? Comment { get; set; }

    public Supplier? Supplier { get; set; }
    public ICollection<PurchaseOrderItem> Items { get; set; } = [];
}

public class PurchaseOrderItem : Entity
{
    public Guid PurchaseOrderId { get; set; }
    public Guid IngredientId { get; set; }
    public decimal Quantity { get; set; }
    public Guid UnitId { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal ReceivedQuantity { get; set; }

    public Inventory.Ingredient? Ingredient { get; set; }
    public Inventory.UnitOfMeasure? Unit { get; set; }

    public decimal LineTotal => Money.Round(Quantity * UnitPrice);
}
