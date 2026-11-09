using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Menu;

public class ModifierGroup : AuditableEntity, ITenantScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int MinSelect { get; set; }
    public int MaxSelect { get; set; } = 1;
    public bool IsRequired { get; set; }
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public ICollection<ModifierOption> Options { get; set; } = [];

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        ArchivedAt = utcNow;
    }
}

public class ModifierOption : Entity, IArchivable
{
    public Guid GroupId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal PriceDelta { get; set; }
    public int SortOrder { get; set; }
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public ModifierGroup? Group { get; set; }

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        ArchivedAt = utcNow;
    }
}

/// <summary>Link menu item to modifier group (composite key MenuItemId + ModifierGroupId).</summary>
public class MenuItemModifierGroup
{
    public Guid MenuItemId { get; set; }
    public Guid ModifierGroupId { get; set; }
    public int SortOrder { get; set; }

    public MenuItem? MenuItem { get; set; }
    public ModifierGroup? ModifierGroup { get; set; }
}
