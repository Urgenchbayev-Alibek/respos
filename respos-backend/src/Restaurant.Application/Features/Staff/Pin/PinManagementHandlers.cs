using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Staff.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Application.Features.Staff.Pin;

/// <summary>PIN state of a user (the hash is never returned). <c>allowed=false</c> for owner/admin/platform admin.</summary>
public sealed record PinStatusDto(bool HasPin, bool Allowed, DateTime? UpdatedAt, DateTime? LockedUntil);

public sealed record GetMyPinQuery;

public sealed class GetMyPinHandler(IApplicationDbContext db, ITenantContext tenant, StaffDirectory directory, IClock clock)
    : IHandler<GetMyPinQuery, PinStatusDto>
{
    public async Task<Result<PinStatusDto>> HandleAsync(GetMyPinQuery request, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == tenant.RequireUserId(), cancellationToken);
        var pin = await db.StaffPins.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken);
        var allowed = !await directory.IsPinForbiddenAsync(user, null, cancellationToken);
        return PinMapper.ToStatus(pin, allowed, clock.UtcNow);
    }
}

public sealed record SetMyPinCommand(string CurrentPassword, string Pin);

public sealed class SetMyPinValidator : AbstractValidator<SetMyPinCommand>
{
    public SetMyPinValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().MaximumLength(PasswordPolicy.MaxLength);
        RuleFor(x => x.Pin).ValidPin();
    }
}

/// <summary><c>PUT /auth/pin</c>: the user sets/changes their own PIN, confirming with the password. Audited.</summary>
public sealed class SetMyPinHandler(
    IApplicationDbContext db, ITenantContext tenant, IPasswordHasher hasher, StaffDirectory directory, IAuditLogger audit, IClock clock)
    : IHandler<SetMyPinCommand, PinStatusDto>
{
    public async Task<Result<PinStatusDto>> HandleAsync(SetMyPinCommand request, CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstAsync(u => u.Id == tenant.RequireUserId(), cancellationToken);
        if (user.PasswordHash is null || !hasher.Verify(user.PasswordHash, request.CurrentPassword))
        {
            return AuthErrors.InvalidCurrentPassword;
        }

        if (await directory.IsPinForbiddenAsync(user, null, cancellationToken))
        {
            return StaffErrors.PinNotAllowed;
        }

        var pin = await PinWriter.SetAsync(db, hasher, user.Id, request.Pin, user.Id, clock.UtcNow, cancellationToken);
        audit.Log("staff.pin_set", nameof(User), user.Id, new { by = "self" });
        await db.SaveChangesAsync(cancellationToken);
        return PinMapper.ToStatus(pin, true, clock.UtcNow);
    }
}

public sealed record RemoveMyPinCommand;

/// <summary><c>DELETE /auth/pin</c>: removes the own PIN (PIN login stops working for the user).</summary>
public sealed class RemoveMyPinHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit) : IHandler<RemoveMyPinCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(RemoveMyPinCommand request, CancellationToken cancellationToken)
    {
        var userId = tenant.RequireUserId();
        if (await db.StaffPins.FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken) is { } pin)
        {
            db.StaffPins.Remove(pin);
            audit.Log("staff.pin_removed", nameof(User), userId, new { by = "self" });
            await db.SaveChangesAsync(cancellationToken);
        }

        return Unit.Value;
    }
}

public sealed record SetMemberPinCommand(string Pin)
{
    [JsonIgnore]
    public Guid UserId { get; init; }
}

public sealed class SetMemberPinValidator : AbstractValidator<SetMemberPinCommand>
{
    public SetMemberPinValidator() => RuleFor(x => x.Pin).ValidPin();
}

/// <summary><c>PUT /staff/members/{userId}/pin</c> (<c>staff.manage</c>): sets an employee's PIN (onboarding). Audited.</summary>
public sealed class SetMemberPinHandler(
    IApplicationDbContext db, ITenantContext tenant, IPasswordHasher hasher, StaffDirectory directory, IAuditLogger audit, IClock clock)
    : IHandler<SetMemberPinCommand, PinStatusDto>
{
    public async Task<Result<PinStatusDto>> HandleAsync(SetMemberPinCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        if (user is null || !await directory.IsBranchMemberAsync(user.Id, orgId, branchId, cancellationToken))
        {
            return StaffErrors.MemberNotFound;
        }

        if (await directory.IsPinForbiddenAsync(user, null, cancellationToken))
        {
            return StaffErrors.PinNotAllowed;
        }

        var pin = await PinWriter.SetAsync(db, hasher, user.Id, request.Pin, tenant.RequireUserId(), clock.UtcNow, cancellationToken);
        audit.Log("staff.pin_set", nameof(User), user.Id, new { by = "manager" });
        await db.SaveChangesAsync(cancellationToken);
        return PinMapper.ToStatus(pin, true, clock.UtcNow);
    }
}

public sealed record ResetMemberPinCommand(Guid UserId);

/// <summary><c>DELETE /staff/members/{userId}/pin</c> (<c>staff.manage</c>): removes the PIN (also clears a lockout). Audited.</summary>
public sealed class ResetMemberPinHandler(IApplicationDbContext db, ITenantContext tenant, StaffDirectory directory, IAuditLogger audit)
    : IHandler<ResetMemberPinCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ResetMemberPinCommand request, CancellationToken cancellationToken)
    {
        if (!await directory.IsBranchMemberAsync(request.UserId, tenant.RequireOrganizationId(), tenant.RequireBranchId(), cancellationToken))
        {
            return StaffErrors.MemberNotFound;
        }

        if (await db.StaffPins.FirstOrDefaultAsync(p => p.UserId == request.UserId, cancellationToken) is { } pin)
        {
            db.StaffPins.Remove(pin);
            audit.Log("staff.pin_reset", nameof(User), request.UserId, new { by = "manager" });
            await db.SaveChangesAsync(cancellationToken);
        }

        return Unit.Value;
    }
}

internal static class PinWriter
{
    public static async Task<StaffPin> SetAsync(
        IApplicationDbContext db, IPasswordHasher hasher, Guid userId, string rawPin, Guid by, DateTime now, CancellationToken ct)
    {
        var hash = hasher.Hash(rawPin);
        var pin = await db.StaffPins.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (pin is null)
        {
            pin = StaffPin.Create(userId, hash, by, now);
            db.StaffPins.Add(pin);
        }
        else
        {
            pin.Change(hash, by, now);
        }

        return pin;
    }
}

internal static class PinMapper
{
    public static PinStatusDto ToStatus(StaffPin? pin, bool allowed, DateTime now) =>
        new(pin is not null, allowed, pin?.UpdatedAt, pin is not null && pin.IsLockedOut(now) ? pin.LockoutUntil : null);
}
