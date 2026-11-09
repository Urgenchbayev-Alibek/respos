using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Menu;

public class MenuCategory : AuditableEntity, ITenantScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameUz { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public ICollection<MenuItem> Items { get; set; } = [];

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        IsActive = false;
        ArchivedAt = utcNow;
    }
}
