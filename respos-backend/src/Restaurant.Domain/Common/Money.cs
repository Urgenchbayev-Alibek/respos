namespace Restaurant.Domain.Common;

/// <summary>Money helpers. All money is decimal(18,2), rounded AwayFromZero (CONVENTIONS.md).</summary>
public static class Money
{
    public const int Decimals = 2;

    public static decimal Round(decimal amount) => Math.Round(amount, Decimals, MidpointRounding.AwayFromZero);

    public static decimal Percent(decimal baseAmount, decimal percent) => Round(baseAmount * percent / 100m);
}
