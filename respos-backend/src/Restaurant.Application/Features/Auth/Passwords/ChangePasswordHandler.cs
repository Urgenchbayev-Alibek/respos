using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Auth.Passwords;

public sealed record ChangePasswordCommand(string CurrentPassword, string NewPassword)
{
    /// <summary>Raw refresh token from the cookie (set by the controller); its family stays signed in.</summary>
    public string? CurrentRefreshToken { get; init; }
}

public sealed class ChangePasswordValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().MaximumLength(PasswordPolicy.MaxLength);
        RuleFor(x => x.NewPassword).StrongPassword().NotEqual(x => x.CurrentPassword)
            .WithMessage("The new password must differ from the current one.");
    }
}

/// <summary>Changes the password of the current user and signs out all other sessions.</summary>
public sealed class ChangePasswordHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IPasswordHasher hasher,
    SessionIssuer sessions,
    IAuditLogger audit) : IHandler<ChangePasswordCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await db.Users.FirstAsync(u => u.Id == tenant.RequireUserId(), cancellationToken);
        if (user.PasswordHash is null || !hasher.Verify(user.PasswordHash, request.CurrentPassword))
        {
            return AuthErrors.InvalidCurrentPassword;
        }

        user.PasswordHash = hasher.Hash(request.NewPassword);
        var current = await sessions.FindRefreshTokenAsync(request.CurrentRefreshToken, cancellationToken);
        var keepFamily = current is not null && current.UserId == user.Id ? current.FamilyId : (Guid?)null;
        await sessions.RevokeAllForUserAsync(user.Id, keepFamily, cancellationToken);
        audit.Log("auth.password_changed", nameof(User), user.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
