using FluentValidation;

namespace Restaurant.Application.Common.Validation;

/// <summary>Password policy (CONVENTIONS.md): min 8 chars, at least 1 letter and 1 digit.</summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;
    public const int MaxLength = 128;
    public const string Message = "Password must be at least 8 characters and contain a letter and a digit.";

    public static bool IsValid(string? password) =>
        password is { Length: >= MinLength and <= MaxLength }
        && password.Any(char.IsLetter)
        && password.Any(char.IsDigit);

    public static IRuleBuilderOptions<T, string> StrongPassword<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().Must(IsValid).WithErrorCode("auth.weak_password").WithMessage(Message);
}

public static class CommonRules
{
    public const int NameMaxLength = 200;
    public const int EmailMaxLength = 256;
    public const int PhoneMaxLength = 32;

    public static IRuleBuilderOptions<T, string> ValidEmail<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().MaximumLength(EmailMaxLength).EmailAddress();

    /// <summary>Optional phone: null/empty is valid (FluentValidation skips null for Matches).</summary>
    public static IRuleBuilderOptions<T, string?> ValidPhone<T>(this IRuleBuilder<T, string?> rule) =>
        rule.MaximumLength(PhoneMaxLength).Matches(@"^(\+?[0-9 ()\-]{5,32})?$");
}
