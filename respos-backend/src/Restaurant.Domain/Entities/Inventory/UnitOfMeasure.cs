using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Inventory;

/// <summary>Org-scoped unit (kg, g, l, ml, pcs seeded per organization).</summary>
public class UnitOfMeasure : Entity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public UnitKind Kind { get; set; }
}

/// <summary>quantityInTo = quantityInFrom × Factor.</summary>
public class UnitConversion : Entity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public Guid FromUnitId { get; set; }
    public Guid ToUnitId { get; set; }
    public decimal Factor { get; set; }

    public UnitOfMeasure? FromUnit { get; set; }
    public UnitOfMeasure? ToUnit { get; set; }
}

public class IngredientCategory : Entity, ITenantScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        ArchivedAt = utcNow;
    }
}

public class Ingredient : AuditableEntity, ITenantScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public Guid? CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public Guid BaseUnitId { get; set; }

    /// <summary>Last purchase price per base unit.</summary>
    public decimal CostPrice { get; set; }

    /// <summary>Supplier used to group purchase suggestions.</summary>
    public Guid? DefaultSupplierId { get; set; }

    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public IngredientCategory? Category { get; set; }
    public UnitOfMeasure? BaseUnit { get; set; }
    public Procurement.Supplier? DefaultSupplier { get; set; }

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        ArchivedAt = utcNow;
    }
}
