namespace Restaurant.Domain.Common;

/// <summary>
/// Organization-scoped data. A global query filter limits queries to the current tenant;
/// the persistence layer fills <see cref="OrganizationId"/> for new rows from the tenant context.
/// </summary>
public interface ITenantScoped
{
    Guid OrganizationId { get; set; }
}

/// <summary>Branch-scoped data. Handlers must filter by the validated current branch explicitly.</summary>
public interface IBranchScoped : ITenantScoped
{
    Guid BranchId { get; }
}

/// <summary>Historical reference data is archived instead of deleted.</summary>
public interface IArchivable
{
    bool IsArchived { get; }
    DateTime? ArchivedAt { get; }
    void Archive(DateTime utcNow);
}
