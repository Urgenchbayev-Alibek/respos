using FluentValidation;

namespace Restaurant.Application.Features.Menu.Common;

public static class MenuRules
{
    public const int DescriptionMaxLength = 2000;
    public const int SkuMaxLength = 64;
    public const int MaxPrepTimeMinutes = 24 * 60;
    public const decimal MaxPrice = 9_999_999_999m;

    /// <summary>Money input: 0 ≤ value ≤ MaxPrice, at most 2 decimals (numeric(18,2)).</summary>
    public static IRuleBuilderOptions<T, decimal> ValidMoney<T>(this IRuleBuilder<T, decimal> rule) =>
        rule.InclusiveBetween(0m, MaxPrice).PrecisionScale(18, 2, ignoreTrailingZeros: true);
}
