using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Identity;

/// <summary>Refresh token (only the SHA-256 hash is stored). Rotated on every use; reuse revokes the family.</summary>
public class RefreshToken : Entity
{
    public Guid UserId { get; set; }
    public Guid? OrganizationId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public Guid FamilyId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
    public string? CreatedByIp { get; set; }

    public User? User { get; set; }

    public bool IsRevoked => RevokedAt is not null;

    public bool IsActive(DateTime utcNow) => RevokedAt is null && ExpiresAt > utcNow;

    public void Revoke(DateTime utcNow, Guid? replacedBy = null)
    {
        RevokedAt ??= utcNow;
        ReplacedByTokenId ??= replacedBy;
    }
}

/// <summary>Invitation to join an organization. The invited user row exists with status Invited (or is an existing user).</summary>
public class UserInvitation : AuditableEntity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public Guid[] RoleIds { get; set; } = [];
    public Guid[] BranchIds { get; set; } = [];
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? AcceptedAt { get; set; }

    public bool IsUsable(DateTime utcNow) => AcceptedAt is null && ExpiresAt > utcNow;
}

public class PasswordResetToken : Entity
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }

    public bool IsUsable(DateTime utcNow) => UsedAt is null && ExpiresAt > utcNow;
}
