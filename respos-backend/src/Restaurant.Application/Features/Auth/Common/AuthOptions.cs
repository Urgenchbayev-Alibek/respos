namespace Restaurant.Application.Features.Auth.Common;

/// <summary>Auth session settings (section "Auth").</summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public int RefreshTokenDays { get; set; } = 14;
    public int PasswordResetTokenMinutes { get; set; } = 60;
    public int InvitationDays { get; set; } = 7;
    public int MaxFailedLoginAttempts { get; set; } = 5;
    public int LockoutMinutes { get; set; } = 15;

    /// <summary>
    /// Seconds after a rotation during which presenting the rotated (old) refresh token is treated as a benign
    /// race (two tabs / a retry) instead of reuse: the current chain is rotated, the family survives. 0 disables.
    /// </summary>
    public int RefreshReuseGraceSeconds { get; set; } = 15;

    /// <summary>Lax (same-site deployment, default) | Strict | None (cross-site; requires Secure).</summary>
    public string RefreshCookieSameSite { get; set; } = "Lax";

    public bool RefreshCookieSecure { get; set; } = true;

    /// <summary>PIN quick login (ADR-0014): wrong PINs per user before <see cref="PinLockoutMinutes"/> lockout.</summary>
    public int PinMaxFailedAttempts { get; set; } = 5;
    public int PinLockoutMinutes { get; set; } = 15;

    /// <summary>Wrong PINs (any user) on one shared device before the device is locked for <see cref="PinLockoutMinutes"/>.</summary>
    public int DeviceMaxFailedPinAttempts { get; set; } = 10;

    /// <summary>Lifetime of a shared-device registration (cookie <c>device_token</c>).</summary>
    public int DeviceTokenDays { get; set; } = 180;

    /// <summary>Refresh-token lifetime of a PIN session (shorter than password sessions).</summary>
    public int PinSessionHours { get; set; } = 12;
}
