using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Staff;

/// <summary>
/// A shared branch device (tablet/terminal) registered for PIN quick login (ADR-0014). Its credential is a random
/// secret stored only as a SHA-256 hash; the raw value lives in the httpOnly cookie <c>device_token</c>.
/// </summary>
public class StaffDevice : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string TokenHash { get; private set; } = string.Empty;
    public DateTime ExpiresAt { get; private set; }
    public DateTime? LastUsedAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public Guid? RevokedBy { get; private set; }
    public int FailedPinCount { get; private set; }
    public DateTime? LockoutUntil { get; private set; }

    public static StaffDevice Register(Guid organizationId, Guid branchId, string name, string tokenHash, DateTime expiresAt) => new()
    {
        OrganizationId = organizationId,
        BranchId = branchId,
        Name = name,
        TokenHash = tokenHash,
        ExpiresAt = expiresAt,
    };

    public bool IsActive(DateTime utcNow) => RevokedAt is null && ExpiresAt > utcNow;

    public bool IsLockedOut(DateTime utcNow) => LockoutUntil is { } until && until > utcNow;

    public void Revoke(Guid? revokedBy, DateTime utcNow)
    {
        RevokedAt ??= utcNow;
        RevokedBy ??= revokedBy;
    }

    /// <summary>Counts a wrong PIN on this device; returns true when this failure locked the device.</summary>
    public bool RegisterFailedPin(DateTime utcNow, int maxAttempts, TimeSpan lockout)
    {
        FailedPinCount++;
        if (FailedPinCount < maxAttempts)
        {
            return false;
        }

        FailedPinCount = 0;
        LockoutUntil = utcNow.Add(lockout);
        return true;
    }

    public void RegisterSuccessfulPin(DateTime utcNow)
    {
        FailedPinCount = 0;
        LockoutUntil = null;
        LastUsedAt = utcNow;
    }
}
