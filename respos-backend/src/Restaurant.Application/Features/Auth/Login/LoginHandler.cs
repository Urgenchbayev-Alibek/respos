using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Auth.Login;

public sealed record LoginCommand(string Email, string Password, Guid? OrganizationId);

public sealed class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.Password).NotEmpty().MaximumLength(PasswordPolicy.MaxLength);
    }
}

/// <summary>
/// Password login with lockout (Auth:MaxFailedLoginAttempts → Auth:LockoutMinutes). Unknown e-mail and wrong
/// password produce the same error and similar timing. Failures are logged; only lockouts are audited.
/// </summary>
public sealed class LoginHandler(
    IApplicationDbContext db,
    IPasswordHasher hasher,
    SessionIssuer sessions,
    IAuditLogger audit,
    IClock clock,
    IOptions<AuthOptions> options,
    ILogger<LoginHandler> logger) : IHandler<LoginCommand, AuthSession>
{
    private static string? _dummyHash;

    public async Task<Result<AuthSession>> HandleAsync(LoginCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var email = User.NormalizeEmail(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
        if (user is null || user.PasswordHash is null)
        {
            hasher.Verify(_dummyHash ??= hasher.Hash(Guid.NewGuid().ToString()), request.Password);
            logger.LogWarning("Login failed: unknown account");
            return AuthErrors.InvalidCredentials;
        }

        if (user.IsLockedOut(now))
        {
            return AuthErrors.AccountLocked;
        }

        if (!hasher.Verify(user.PasswordHash, request.Password))
        {
            await RegisterFailureAsync(user, now, cancellationToken);
            return AuthErrors.InvalidCredentials;
        }

        if (user.Status != UserStatus.Active)
        {
            logger.LogWarning("Login refused for user {UserId} with status {Status}", user.Id, user.Status);
            return user.Status is UserStatus.Blocked or UserStatus.Deactivated
                ? AuthErrors.AccountBlocked
                : AuthErrors.InvalidCredentials;
        }

        var organization = await sessions.ResolveOrganizationAsync(user, request.OrganizationId, cancellationToken);
        if (organization.IsFailure)
        {
            return organization.Error;
        }

        user.RegisterSuccessfulLogin(now);
        var session = await sessions.IssueAsync(user, organization.Value, null, cancellationToken);
        audit.Log(new AuditEntry("auth.login_succeeded", nameof(User), user.Id.ToString())
        {
            OrganizationId = organization.Value,
            UserId = user.Id,
        });
        await db.SaveChangesAsync(cancellationToken);
        return session;
    }

    private async Task RegisterFailureAsync(User user, DateTime now, CancellationToken ct)
    {
        var settings = options.Value;
        var locked = user.RegisterFailedLogin(now, settings.MaxFailedLoginAttempts, TimeSpan.FromMinutes(settings.LockoutMinutes));
        logger.LogWarning("Login failed for user {UserId}", user.Id);
        if (locked)
        {
            audit.Log(new AuditEntry("auth.account_locked", nameof(User), user.Id.ToString(),
                new { settings.MaxFailedLoginAttempts, settings.LockoutMinutes })
            {
                UserId = user.Id,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
