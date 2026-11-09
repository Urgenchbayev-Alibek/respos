using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Identity;

/// <summary>Global identity (may belong to several organizations via <see cref="UserOrganization"/>).</summary>
public class User : AuditableEntity
{
    public string Email { get; private set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string PreferredLanguage { get; set; } = "ru";
    public bool IsPlatformAdmin { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
    public DateTime? LastLoginAt { get; set; }
    public int FailedLoginCount { get; private set; }
    public DateTime? LockoutUntil { get; private set; }

    public ICollection<UserOrganization> Organizations { get; set; } = [];
    public ICollection<UserRole> Roles { get; set; } = [];
    public ICollection<UserBranchAccess> BranchAccesses { get; set; } = [];

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public void SetEmail(string email) => Email = NormalizeEmail(email);

    public bool IsLockedOut(DateTime utcNow) => LockoutUntil is { } until && until > utcNow;

    /// <summary>Registers a failed login; returns true when this failure triggered a lockout.</summary>
    public bool RegisterFailedLogin(DateTime utcNow, int maxAttempts, TimeSpan lockoutDuration)
    {
        FailedLoginCount++;
        if (FailedLoginCount < maxAttempts)
        {
            return false;
        }

        FailedLoginCount = 0;
        LockoutUntil = utcNow.Add(lockoutDuration);
        return true;
    }

    public void RegisterSuccessfulLogin(DateTime utcNow)
    {
        ResetLockout();
        LastLoginAt = utcNow;
    }

    public void ResetLockout()
    {
        FailedLoginCount = 0;
        LockoutUntil = null;
    }
}

/// <summary>Membership of a user in an organization. Unique (UserId, OrganizationId).</summary>
public class UserOrganization : Entity, ITenantScoped
{
    public Guid UserId { get; set; }
    public Guid OrganizationId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime JoinedAt { get; set; }

    public User? User { get; set; }
    public Organization? Organization { get; set; }
}
