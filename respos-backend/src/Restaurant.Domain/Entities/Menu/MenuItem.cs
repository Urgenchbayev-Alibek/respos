using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Menu;

public class MenuItem : AuditableEntity, ITenantScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public Guid CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameUz { get; set; }
    public string? Description { get; set; }
    public string? PhotoUrl { get; set; }
    public decimal Price { get; set; }
    public int PrepTimeMinutes { get; set; }
    public Guid? KitchenStationId { get; set; }
    public bool IsAvailable { get; set; } = true;
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public string? Sku { get; set; }

    public MenuCategory? Category { get; set; }
    public ICollection<MenuItemVariant> Variants { get; set; } = [];
    public ICollection<MenuItemModifierGroup> ModifierGroups { get; set; } = [];
    public ICollection<MenuAvailability> Availability { get; set; } = [];

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        IsAvailable = false;
        ArchivedAt = utcNow;
    }
}

/// <summary>Variant with an absolute price (e.g. "0.5 порции").</summary>
public class MenuItemVariant : Entity, IArchivable
{
    public Guid MenuItemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsDefault { get; set; }
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public MenuItem? MenuItem { get; set; }

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        ArchivedAt = utcNow;
    }
}

/// <summary>Time-of-day availability window (branch timezone). DayOfWeek null = every day.</summary>
public class MenuAvailability : Entity
{
    public Guid MenuItemId { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }

    public MenuItem? MenuItem { get; set; }
}
