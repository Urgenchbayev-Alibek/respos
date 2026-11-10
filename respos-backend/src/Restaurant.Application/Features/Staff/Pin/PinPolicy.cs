using FluentValidation;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Application.Features.Staff.Pin;

/// <summary>PIN rules (ADR-0014): 4–6 ASCII digits, not all the same digit, not an ascending/descending run.</summary>
public static class PinPolicy
{
    public const int MinLength = 4;
    public const int MaxLength = 6;

    public static bool IsValid(string? pin)
    {
        if (pin is null || pin.Length is < MinLength or > MaxLength || !pin.All(char.IsAsciiDigit))
        {
            return false;
        }

        var allSame = pin.All(c => c == pin[0]);
        var ascending = Enumerable.Range(1, pin.Length - 1).All(i => pin[i] - pin[i - 1] == 1);
        var descending = Enumerable.Range(1, pin.Length - 1).All(i => pin[i - 1] - pin[i] == 1);
        return !allSame && !ascending && !descending;
    }

    public static IRuleBuilderOptions<T, string> ValidPin<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().Must(IsValid).WithErrorCode(StaffErrors.PinWeak.Code).WithMessage(StaffErrors.PinWeak.Message);

    /// <summary>Input format for login (no strength check, so a policy change never locks out existing PINs).</summary>
    public static IRuleBuilderOptions<T, string> PinFormat<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().Length(MinLength, MaxLength).Must(p => p.All(char.IsAsciiDigit)).WithMessage("PIN must be 4-6 digits.");
}
