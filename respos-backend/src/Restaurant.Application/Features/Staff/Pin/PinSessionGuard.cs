using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Application.Features.Staff.Devices;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Staff.Pin;

/// <summary>
/// Refresh-time checks for PIN sessions (ADR-0014). A refresh family created by PIN login stays valid only while the
/// request carries the same active device credential, the user is still PIN-eligible in the branch and the absolute
/// session lifetime (<see cref="AuthOptions.PinSessionHours"/>, counted from the PIN login) has not passed.
/// Password sessions (no <see cref="Domain.Entities.Staff.PinSession"/> row) → <c>null</c> scope.
/// </summary>
[ScopedService]
public sealed class PinSessionGuard(
    IApplicationDbContext db, DeviceCredentials devices, StaffDirectory directory, IOptions<AuthOptions> options)
{
    private static readonly Error Rejected = AuthErrors.InvalidRefreshToken;

    public async Task<Result<SessionScope?>> ResolveScopeAsync(
        RefreshToken token, User user, string? rawDeviceToken, DateTime now, CancellationToken ct)
    {
        var pinSession = await db.PinSessions.AsNoTracking().FirstOrDefaultAsync(p => p.FamilyId == token.FamilyId, ct);
        if (pinSession is null)
        {
            return Result.Success<SessionScope?>(null);
        }

        var expiresAt = pinSession.CreatedAt.AddHours(options.Value.PinSessionHours);
        var device = await devices.FindActiveAsync(rawDeviceToken, ct);
        if (expiresAt <= now
            || device is null
            || device.Id != pinSession.DeviceId
            || !await directory.IsPinEligibleAsync(user.Id, pinSession.OrganizationId, pinSession.BranchId, ct))
        {
            return Result.Failure<SessionScope?>(Rejected);
        }

        return Result.Success<SessionScope?>(new SessionScope(pinSession.BranchId, pinSession.DeviceId, expiresAt - now));
    }
}
