using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Restaurant.Infrastructure.Persistence.Conventions;

/// <summary>Stores enums as snake_case strings ("InProgress" ↔ "in_progress"), identical to the JSON contract.</summary>
public sealed class SnakeCaseEnumConverter<TEnum>() : ValueConverter<TEnum, string>(
    value => EnumNames<TEnum>.ToName(value),
    name => EnumNames<TEnum>.FromName(name))
    where TEnum : struct, Enum;

internal static class EnumNames<TEnum>
    where TEnum : struct, Enum
{
    private static readonly ConcurrentDictionary<TEnum, string> Names = new(
        Enum.GetValues<TEnum>().ToDictionary(v => v, v => JsonNamingPolicy.SnakeCaseLower.ConvertName(v.ToString())));

    private static readonly Dictionary<string, TEnum> Values =
        Names.ToDictionary(kv => kv.Value, kv => kv.Key, StringComparer.Ordinal);

    public static string ToName(TEnum value) => Names[value];

    public static TEnum FromName(string name) =>
        Values.TryGetValue(name, out var value)
            ? value
            : throw new InvalidOperationException($"Unknown {typeof(TEnum).Name} value '{name}'.");
}
