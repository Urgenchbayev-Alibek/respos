using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Application.Features.Staff.Devices;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Application.Features.Staff.Pin;

public sealed record PinLoginCommand(Guid UserId, string Pin)
{
    /// <summary>Raw shared-device credential from the httpOnly cookie (set by the controller, never from the body).</summary>
    [JsonIgnore]
    public string? DeviceToken { get; init; }

    /// <summary>Refresh cookie of the previous user on this device (revoked on a successful switch).</summary>
    [JsonIgnore]
    public string? PreviousRefreshToken { get; init; }
}

public sealed class PinLoginValidator : AbstractValidator<PinLoginCommand>
{
    public PinLoginValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Pin).PinFormat();
    }
}

/// <summary>
/// <c>POST /auth/pin-login</c> (ADR-0014). Only on a registered shared device (cookie <c>device_token</c>), only for PIN-eligible
/// members of the device's branch. Wrong PINs count per user (5 → 15 min) and per device (10 → 15 min); unknown or
/// ineligible users fail like a wrong PIN (no enumeration). Success → access token scoped to the branch + PIN refresh session.
/// </summary>
public sealed class PinLoginHandler(
    IApplicationDbContext db,
    IPasswordHasher hasher,
    DeviceCredentials devices,
    StaffDirectory directory,
    SessionIssuer sessions,
    IAuditLogger audit,
    IClock clock,
    IOptions<AuthOptions> options,
    ILogger<PinLoginHandler> logger) : IHandler<PinLoginCommand, AuthSession>
{
    private static string? _dummyHash;

    public async Task<Result<AuthSession>> HandleAsync(PinLoginCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var settings = options.Value;
        var device = await devices.FindActiveAsync(request.DeviceToken, cancellationToken);
        if (device is null)
        {
            return StaffErrors.DeviceInvalid;
        }

        if (device.IsLockedOut(now))
        {
            return StaffErrors.DeviceLocked;
        }

        var eligible = await directory.IsPinEligibleAsync(request.UserId, device.OrganizationId, device.BranchId, cancellationToken);
        var pin = eligible ? await db.StaffPins.FirstOrDefaultAsync(p => p.UserId == request.UserId, cancellationToken) : null;
        if (pin is null)
        {
            hasher.Verify(_dummyHash ??= hasher.Hash("000000"), request.Pin);
            await RegisterDeviceFailureAsync(device, request.UserId, now, cancellationToken);
            return StaffErrors.PinInvalid;
        }

        if (pin.IsLockedOut(now))
        {
            return StaffErrors.PinLocked;
        }

        if (!hasher.Verify(pin.PinHash, request.Pin))
        {
            if (pin.RegisterFailure(now, settings.PinMaxFailedAttempts, TimeSpan.FromMinutes(settings.PinLockoutMinutes)))
            {
                audit.Log(Entry("auth.pin_locked", nameof(User), pin.UserId.ToString(), device, pin.UserId,
                    new { settings.PinMaxFailedAttempts, settings.PinLockoutMinutes }));
            }

            await RegisterDeviceFailureAsync(device, pin.UserId, now, cancellationToken);
            return StaffErrors.PinInvalid;
        }

        var user = await db.Users.FirstAsync(u => u.Id == pin.UserId, cancellationToken);
        if (await sessions.FindRefreshTokenAsync(request.PreviousRefreshToken, cancellationToken) is { IsRevoked: false } previous)
        {
            previous.Revoke(now);
        }

        pin.RegisterSuccess();
        device.RegisterSuccessfulPin(now);
        user.RegisterSuccessfulLogin(now);
        var scope = new SessionScope(device.BranchId, device.Id, TimeSpan.FromHours(settings.PinSessionHours));
        var (session, refresh) = await sessions.IssueWithTokenAsync(user, device.OrganizationId, null, cancellationToken, scope);
        db.PinSessions.Add(new PinSession
        {
            FamilyId = refresh.FamilyId,
            DeviceId = device.Id,
            OrganizationId = device.OrganizationId,
            BranchId = device.BranchId,
            UserId = user.Id,
            CreatedAt = now,
        });
        audit.Log(Entry("auth.pin_login_succeeded", nameof(User), user.Id.ToString(), device, user.Id, new { deviceId = device.Id }));
        await db.SaveChangesAsync(cancellationToken);
        return session;
    }

    private async Task RegisterDeviceFailureAsync(StaffDevice device, Guid userId, DateTime now, CancellationToken ct)
    {
        var settings = options.Value;
        logger.LogWarning("PIN login failed on device {DeviceId}", device.Id);
        if (device.RegisterFailedPin(now, settings.DeviceMaxFailedPinAttempts, TimeSpan.FromMinutes(settings.PinLockoutMinutes)))
        {
            audit.Log(Entry("staff.device_locked", nameof(StaffDevice), device.Id.ToString(), device, null,
                new { settings.DeviceMaxFailedPinAttempts, settings.PinLockoutMinutes, lastUserId = userId }));
        }

        await db.SaveChangesAsync(ct);
    }

    private static AuditEntry Entry(string action, string type, string id, StaffDevice device, Guid? userId, object changes) =>
        new(action, type, id, changes) { OrganizationId = device.OrganizationId, BranchId = device.BranchId, UserId = userId };
}
