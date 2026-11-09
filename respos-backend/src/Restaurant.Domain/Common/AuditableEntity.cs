namespace Restaurant.Domain.Common;

/// <summary>Entity with created/updated stamps. Values are set by the persistence interceptor.</summary>
public abstract class AuditableEntity : Entity, IAuditable
{
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }
}

public interface IAuditable
{
    DateTime CreatedAt { get; set; }
    Guid? CreatedBy { get; set; }
    DateTime? UpdatedAt { get; set; }
    Guid? UpdatedBy { get; set; }
}
