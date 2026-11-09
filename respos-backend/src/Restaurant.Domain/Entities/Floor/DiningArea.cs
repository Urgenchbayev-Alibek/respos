using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Floor;

public class DiningArea : AuditableEntity, IBranchScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    public ICollection<DiningTable> Tables { get; set; } = [];

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        IsActive = false;
        ArchivedAt = utcNow;
    }
}

public class DiningTable : AuditableEntity, IBranchScoped, IArchivable
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid DiningAreaId { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public TableStatus Status { get; set; } = TableStatus.Available;
    public bool IsActive { get; set; } = true;
    public bool IsArchived { get; private set; }
    public DateTime? ArchivedAt { get; private set; }
    public decimal? PosX { get; set; }
    public decimal? PosY { get; set; }

    public DiningArea? DiningArea { get; set; }

    public void Archive(DateTime utcNow)
    {
        IsArchived = true;
        IsActive = false;
        ArchivedAt = utcNow;
    }
}
