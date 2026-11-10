using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Entities.Staff;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Staff.Devices;

/// <summary>
/// Resolves the shared-device credential (raw cookie value → SHA-256 hash lookup). A device is usable only when it
/// is not revoked/expired and its branch and organization are active. Works without a tenant context.
/// </summary>
[ScopedService]
public sealed class DeviceCredentials(IApplicationDbContext db, ISecureTokenGenerator tokens, IClock clock)
{
    public async Task<StaffDevice?> FindActiveAsync(string? rawToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rawToken) || rawToken.Length > 256)
        {
            return null;
        }

        var hash = tokens.Hash(rawToken);
        var device = await db.StaffDevices.IgnoreQueryFilters().FirstOrDefaultAsync(d => d.TokenHash == hash, ct);
        if (device is null || !device.IsActive(clock.UtcNow))
        {
            return null;
        }

        var usable = await db.Branches.IgnoreQueryFilters().AnyAsync(
            b => b.Id == device.BranchId && b.OrganizationId == device.OrganizationId && b.IsActive
                 && b.Organization!.Status == OrganizationStatus.Active, ct);
        return usable ? device : null;
    }

    public bool Matches(StaffDevice device, string? rawToken) =>
        !string.IsNullOrWhiteSpace(rawToken) && rawToken.Length <= 256 && tokens.Hash(rawToken) == device.TokenHash;

    /// <summary>Revokes the device and every refresh token issued through it (PIN sessions). Executes immediately.</summary>
    public async Task RevokeWithSessionsAsync(StaffDevice device, Guid? revokedBy, CancellationToken ct)
    {
        var now = clock.UtcNow;
        device.Revoke(revokedBy, now);
        await db.RefreshTokens.IgnoreQueryFilters()
            .Where(t => t.RevokedAt == null && db.PinSessions.Any(p => p.DeviceId == device.Id && p.FamilyId == t.FamilyId))
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }
}
