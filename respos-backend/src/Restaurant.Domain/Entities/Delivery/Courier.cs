using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Delivery;

/// <summary>A delivery courier of a branch (not necessarily a system user).</summary>
public class Courier : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
