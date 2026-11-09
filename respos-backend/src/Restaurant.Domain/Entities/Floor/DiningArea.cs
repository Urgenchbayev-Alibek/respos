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

    /// <summary>Throws when the table cannot take guests/reservations (archived or manually unavailable).</summary>
    public void EnsureUsable()
    {
        if (IsArchived)
        {
            throw new Exceptions.DomainException(FloorErrors.TableArchived);
        }

        if (Status == TableStatus.Unavailable || !IsActive)
        {
            throw new Exceptions.DomainException(FloorErrors.TableUnavailable);
        }
    }

    /// <summary>
    /// Manual status change (BR-4.2): only available/unavailable; not while an order is active.
    /// Returns true when the status actually changed.
    /// </summary>
    public bool SetManualStatus(TableStatus status, bool hasActiveOrder)
    {
        if (IsArchived)
        {
            throw new Exceptions.DomainException(FloorErrors.TableArchived);
        }

        if (status is not (TableStatus.Available or TableStatus.Unavailable))
        {
            throw new Exceptions.DomainException(FloorErrors.InvalidManualStatus);
        }

        if (hasActiveOrder)
        {
            throw new Exceptions.DomainException(FloorErrors.TableHasActiveOrder);
        }

        return ChangeStatus(status);
    }

    /// <summary>Guests seated (reservation seat). Returns true when the status changed.</summary>
    public bool Occupy()
    {
        EnsureUsable();
        return ChangeStatus(TableStatus.Occupied);
    }

    /// <summary>
    /// Frees an occupied/reserved table when nothing keeps it busy (DECISIONS_v1_1 item 12).
    /// Unavailable tables stay unavailable. Returns true when the status changed.
    /// </summary>
    public bool ReleaseIfIdle(bool hasActiveOrder)
    {
        if (hasActiveOrder || Status is not (TableStatus.Occupied or TableStatus.Reserved))
        {
            return false;
        }

        return ChangeStatus(TableStatus.Available);
    }

    private bool ChangeStatus(TableStatus status)
    {
        if (Status == status)
        {
            return false;
        }

        Status = status;
        return true;
    }
}
