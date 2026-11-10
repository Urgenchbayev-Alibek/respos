using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Application.Features.Staff.Devices;

public sealed record DeviceDto(
    Guid Id, string Name, Guid BranchId, DateTime CreatedAt, string? CreatedByName, DateTime ExpiresAt, DateTime? LastUsedAt,
    DateTime? RevokedAt, bool IsActive, DateTime? LockedUntil);

/// <summary>What the lock screen of a shared device may know (no secrets, no ids of other branches).</summary>
public sealed record CurrentDeviceDto(Guid Id, string Name, Guid BranchId, string BranchName, string OrganizationName);

/// <summary>Lock-screen avatar: only the name of a PIN-enabled employee of the device's branch.</summary>
public sealed record DeviceStaffDto(Guid Id, string FullName);

/// <summary>Raw device secret for the cookie + the DTO for the body (the secret is never in the body).</summary>
public sealed record DeviceRegistration(DeviceDto Device, string RawToken, DateTime ExpiresAt);

public sealed record RegisterDeviceCommand(string Name);

public sealed class RegisterDeviceValidator : AbstractValidator<RegisterDeviceCommand>
{
    public RegisterDeviceValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
}

/// <summary>
/// <c>POST /auth/device/register</c> (<c>staff.manage</c>, <c>X-Branch-Id</c>): turns the current browser into a shared device of the
/// branch. Issues a random 256-bit credential (stored hashed), set by the controller as httpOnly cookie <c>device_token</c>. Audited.
/// </summary>
public sealed class RegisterDeviceHandler(
    IApplicationDbContext db, ITenantContext tenant, ISecureTokenGenerator tokens, IAuditLogger audit, IClock clock,
    IOptions<AuthOptions> options) : IHandler<RegisterDeviceCommand, DeviceRegistration>
{
    public async Task<Result<DeviceRegistration>> HandleAsync(RegisterDeviceCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var raw = tokens.Generate();
        var device = StaffDevice.Register(
            tenant.RequireOrganizationId(), tenant.RequireBranchId(), request.Name.Trim(), tokens.Hash(raw),
            now.AddDays(options.Value.DeviceTokenDays));
        db.StaffDevices.Add(device);
        audit.Log("staff.device_registered", nameof(StaffDevice), device.Id, new { device.Name, device.ExpiresAt });
        await db.SaveChangesAsync(cancellationToken);
        return new DeviceRegistration(DeviceMapper.ToDto(device, null, now), raw, device.ExpiresAt);
    }
}

public sealed record GetCurrentDeviceQuery(string? DeviceToken);

/// <summary><c>GET /auth/device</c> (anonymous, cookie): 200 for an active shared device, else 401 <c>device.invalid</c>.</summary>
public sealed class GetCurrentDeviceHandler(IApplicationDbContext db, DeviceCredentials devices) : IHandler<GetCurrentDeviceQuery, CurrentDeviceDto>
{
    public async Task<Result<CurrentDeviceDto>> HandleAsync(GetCurrentDeviceQuery request, CancellationToken cancellationToken)
    {
        var device = await devices.FindActiveAsync(request.DeviceToken, cancellationToken);
        if (device is null)
        {
            return StaffErrors.DeviceInvalid;
        }

        var branch = await db.Branches.IgnoreQueryFilters().AsNoTracking()
            .Where(b => b.Id == device.BranchId)
            .Select(b => new { b.Name, OrganizationName = b.Organization!.Name })
            .FirstAsync(cancellationToken);
        return new CurrentDeviceDto(device.Id, device.Name, device.BranchId, branch.Name, branch.OrganizationName);
    }
}

public sealed record ListDeviceStaffQuery(string? DeviceToken);

/// <summary><c>GET /auth/device/staff</c> (anonymous, cookie): PIN-enabled, PIN-eligible staff of the device's branch, names only.</summary>
public sealed class ListDeviceStaffHandler(IApplicationDbContext db, DeviceCredentials devices, StaffDirectory directory)
    : IHandler<ListDeviceStaffQuery, IReadOnlyList<DeviceStaffDto>>
{
    public async Task<Result<IReadOnlyList<DeviceStaffDto>>> HandleAsync(ListDeviceStaffQuery request, CancellationToken cancellationToken)
    {
        var device = await devices.FindActiveAsync(request.DeviceToken, cancellationToken);
        if (device is null)
        {
            return StaffErrors.DeviceInvalid;
        }

        var staff = await directory.PinEligibleMembers(device.OrganizationId, device.BranchId)
            .Where(u => db.StaffPins.Any(p => p.UserId == u.Id))
            .OrderBy(u => u.FullName)
            .Select(u => new DeviceStaffDto(u.Id, u.FullName))
            .ToListAsync(cancellationToken);
        return staff;
    }
}

public sealed record ForgetDeviceCommand(string? DeviceToken);

/// <summary>
/// <c>POST /auth/device/forget</c> (<c>staff.manage</c>): ends shared mode on this browser — revokes the device presented by the cookie
/// (only a device of the caller's organization) and all its PIN sessions. Always 204; the controller clears the cookie.
/// </summary>
public sealed class ForgetDeviceHandler(IApplicationDbContext db, ITenantContext tenant, DeviceCredentials devices, IAuditLogger audit)
    : IHandler<ForgetDeviceCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ForgetDeviceCommand request, CancellationToken cancellationToken)
    {
        var device = await devices.FindActiveAsync(request.DeviceToken, cancellationToken);
        if (device is null || device.OrganizationId != tenant.OrganizationId)
        {
            return Unit.Value;
        }

        await devices.RevokeWithSessionsAsync(device, tenant.UserId, cancellationToken);
        audit.Log("staff.device_revoked", nameof(StaffDevice), device.Id, new { device.Name, reason = "forgotten_on_device" });
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

public sealed record ListDevicesQuery(bool IncludeRevoked = false);

/// <summary><c>GET /staff/devices</c> (<c>staff.manage</c>): shared devices of the current branch.</summary>
public sealed class ListDevicesHandler(IApplicationDbContext db, ITenantContext tenant, StaffDirectory directory, IClock clock)
    : IHandler<ListDevicesQuery, IReadOnlyList<DeviceDto>>
{
    public async Task<Result<IReadOnlyList<DeviceDto>>> HandleAsync(ListDevicesQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var now = clock.UtcNow;
        var devices = await db.StaffDevices.AsNoTracking()
            .Where(d => d.BranchId == branchId && (request.IncludeRevoked || (d.RevokedAt == null && d.ExpiresAt > now)))
            .OrderByDescending(d => d.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);
        var names = await directory.NamesAsync(devices.Where(d => d.CreatedBy != null).Select(d => d.CreatedBy!.Value), cancellationToken);
        return devices.Select(d => DeviceMapper.ToDto(d, d.CreatedBy is { } by ? names.GetValueOrDefault(by) : null, now)).ToList();
    }
}

public sealed record RevokeDeviceCommand(Guid DeviceId);

/// <summary><c>POST /staff/devices/{id}/revoke</c> (<c>staff.manage</c>): revokes the device and ends its PIN sessions. Audited.</summary>
public sealed class RevokeDeviceHandler(IApplicationDbContext db, ITenantContext tenant, DeviceCredentials devices, IAuditLogger audit, IClock clock)
    : IHandler<RevokeDeviceCommand, DeviceDto>
{
    public async Task<Result<DeviceDto>> HandleAsync(RevokeDeviceCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var device = await db.StaffDevices.FirstOrDefaultAsync(d => d.Id == request.DeviceId && d.BranchId == branchId, cancellationToken);
        if (device is null)
        {
            return StaffErrors.DeviceNotFound;
        }

        if (device.RevokedAt is null)
        {
            await devices.RevokeWithSessionsAsync(device, tenant.UserId, cancellationToken);
            audit.Log("staff.device_revoked", nameof(StaffDevice), device.Id, new { device.Name });
            await db.SaveChangesAsync(cancellationToken);
        }

        return DeviceMapper.ToDto(device, null, clock.UtcNow);
    }
}

internal static class DeviceMapper
{
    public static DeviceDto ToDto(StaffDevice d, string? createdByName, DateTime now) =>
        new(d.Id, d.Name, d.BranchId, d.CreatedAt, createdByName, d.ExpiresAt, d.LastUsedAt, d.RevokedAt, d.IsActive(now),
            d.IsLockedOut(now) ? d.LockoutUntil : null);
}
