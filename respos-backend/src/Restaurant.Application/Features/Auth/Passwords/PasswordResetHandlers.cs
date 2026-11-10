using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Email;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Options;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Integrations.Email;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Auth.Passwords;

public sealed record ForgotPasswordCommand(string Email);

public sealed class ForgotPasswordValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordValidator() => RuleFor(x => x.Email).ValidEmail();
}

/// <summary>Always succeeds (202) — never reveals whether the account exists. Sends a reset link to active users.</summary>
public sealed class ForgotPasswordHandler(
    IApplicationDbContext db,
    ISecureTokenGenerator tokenGenerator,
    IEmailSender email,
    IAuditLogger audit,
    IClock clock,
    IOptions<AuthOptions> authOptions,
    IOptions<FrontendOptions> frontend) : IHandler<ForgotPasswordCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ForgotPasswordCommand request, CancellationToken cancellationToken)
    {
        var normalized = User.NormalizeEmail(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalized, cancellationToken);
        if (user is null || user.Status != UserStatus.Active)
        {
            return Unit.Value;
        }

        var now = clock.UtcNow;
        var raw = tokenGenerator.Generate();
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = tokenGenerator.Hash(raw),
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(authOptions.Value.PasswordResetTokenMinutes),
        });
        audit.Log(new AuditEntry("auth.password_reset_requested", nameof(User), user.Id.ToString()) { UserId = user.Id });
        await db.SaveChangesAsync(cancellationToken);

        var link = $"{frontend.Value.AppUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(raw)}";
        await email.SendAsync(EmailTemplates.PasswordReset(user.Email, link, user.PreferredLanguage), cancellationToken);
        return Unit.Value;
    }
}

public sealed record ResetPasswordCommand(string Token, string NewPassword);

public sealed class ResetPasswordValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordValidator()
    {
        RuleFor(x => x.Token).NotEmpty().MaximumLength(256);
        RuleFor(x => x.NewPassword).StrongPassword();
    }
}

/// <summary>Sets a new password with a single-use token, clears lockout and revokes all sessions.</summary>
public sealed class ResetPasswordHandler(
    IApplicationDbContext db,
    ISecureTokenGenerator tokenGenerator,
    IPasswordHasher hasher,
    SessionIssuer sessions,
    IAuditLogger audit,
    IClock clock) : IHandler<ResetPasswordCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var hash = tokenGenerator.Hash(request.Token);
        var token = await db.PasswordResetTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        if (token is null || token.UsedAt is not null)
        {
            return AuthErrors.InvalidToken;
        }

        if (!token.IsUsable(now))
        {
            return AuthErrors.TokenExpired;
        }

        var user = await db.Users.FirstAsync(u => u.Id == token.UserId, cancellationToken);
        if (user.Status != UserStatus.Active)
        {
            return AuthErrors.InvalidToken;
        }

        user.PasswordHash = hasher.Hash(request.NewPassword);
        user.ResetLockout();
        token.UsedAt = now;
        await sessions.RevokeAllForUserAsync(user.Id, null, cancellationToken);
        audit.Log(new AuditEntry("auth.password_reset", nameof(User), user.Id.ToString()) { UserId = user.Id });
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
