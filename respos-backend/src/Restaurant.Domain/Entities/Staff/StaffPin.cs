using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Staff;

/// <summary>
/// Quick-login PIN of a user (global, like the password). Only the PasswordHasher (PBKDF2) hash is stored.
/// Lockout: <c>Auth:PinMaxFailedAttempts</c> wrong PINs → <c>Auth:PinLockoutMinutes</c>.
/// </summary>
public class StaffPin : Entity
{
    public Guid UserId { get; private set; }
    public string PinHash { get; private set; } = string.Empty;
    public DateTime UpdatedAt { get; private set; }
    public Guid? UpdatedBy { get; private set; }
    public int FailedCount { get; private set; }
    public DateTime? LockoutUntil { get; private set; }

    public static StaffPin Create(Guid userId, string pinHash, Guid updatedBy, DateTime utcNow)
    {
        var pin = new StaffPin { UserId = userId };
        pin.Change(pinHash, updatedBy, utcNow);
        return pin;
    }

    public void Change(string pinHash, Guid updatedBy, DateTime utcNow)
    {
        PinHash = pinHash;
        UpdatedBy = updatedBy;
        UpdatedAt = utcNow;
        FailedCount = 0;
        LockoutUntil = null;
    }

    public bool IsLockedOut(DateTime utcNow) => LockoutUntil is { } until && until > utcNow;

    /// <summary>Returns true when this failure triggered the lockout.</summary>
    public bool RegisterFailure(DateTime utcNow, int maxAttempts, TimeSpan lockout)
    {
        FailedCount++;
        if (FailedCount < maxAttempts)
        {
            return false;
        }

        FailedCount = 0;
        LockoutUntil = utcNow.Add(lockout);
        return true;
    }

    public void RegisterSuccess()
    {
        FailedCount = 0;
        LockoutUntil = null;
    }
}

/// <summary>
/// Links a refresh-token family issued by PIN login to its device and branch: refresh keeps the branch scope and
/// requires the same, still active device (revoking the device ends these sessions).
/// </summary>
public class PinSession : Entity
{
    public Guid FamilyId { get; set; }
    public Guid DeviceId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; }
}
