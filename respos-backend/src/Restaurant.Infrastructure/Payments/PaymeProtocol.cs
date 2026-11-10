using System.Text.Json;
using System.Text.Json.Nodes;
using Restaurant.Application.Abstractions.Payments;

namespace Restaurant.Infrastructure.Payments;

/// <summary>
/// Payme Merchant API JSON-RPC 2.0 envelope and error codes (developer.help.paycom.uz). Payme always expects HTTP 200;
/// errors are <c>{ error: { code, message: { ru, uz, en }, data } }</c>. Amounts are in tiyin (1 UZS = 100 tiyin).
/// </summary>
internal static class PaymeProtocol
{
    public const int InvalidAmount = -31001;
    public const int TransactionNotFound = -31003;
    public const int CannotCancel = -31007;
    public const int CannotPerform = -31008;
    public const int OrderNotFound = -31050;
    public const int OrderBusy = -31051;
    public const int InsufficientPrivileges = -32504;
    public const int MethodNotFound = -32601;
    public const int ParseError = -32700;
    public const int InvalidRequest = -32600;

    /// <summary>CancelTransaction reason for a transaction that timed out (docs reason 4).</summary>
    public const int ReasonTimeout = 4;

    /// <summary>Reason used when the order can no longer accept the payment (docs reason 3: execution error).</summary>
    public const int ReasonExecutionError = 3;

    private static readonly Dictionary<int, (string Ru, string Uz, string En)> Messages = new()
    {
        [InvalidAmount] = ("Неверная сумма", "Noto'g'ri summa", "Invalid amount"),
        [TransactionNotFound] = ("Транзакция не найдена", "Tranzaksiya topilmadi", "Transaction not found"),
        [CannotCancel] = ("Заказ выполнен. Невозможно отменить транзакцию", "Buyurtma bajarilgan. Tranzaksiyani bekor qilib bo'lmaydi",
            "Order completed. The transaction cannot be cancelled"),
        [CannotPerform] = ("Невозможно выполнить операцию", "Amalni bajarib bo'lmaydi", "Unable to perform the operation"),
        [OrderNotFound] = ("Заказ не найден или недоступен для оплаты", "Buyurtma topilmadi yoki to'lov uchun mavjud emas",
            "Order not found or not payable"),
        [OrderBusy] = ("По заказу уже есть ожидающая транзакция", "Buyurtma bo'yicha kutilayotgan tranzaksiya mavjud",
            "The order already has a pending transaction"),
        [InsufficientPrivileges] = ("Недостаточно привилегий", "Imtiyozlar yetarli emas", "Insufficient privileges"),
        [MethodNotFound] = ("Метод не найден", "Metod topilmadi", "Method not found"),
        [ParseError] = ("Ошибка разбора JSON", "JSON tahlilida xatolik", "JSON parse error"),
        [InvalidRequest] = ("Неверный запрос", "Noto'g'ri so'rov", "Invalid request"),
    };

    public static ProviderCallbackResponse Result(JsonNode? id, JsonObject result) =>
        Write(new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id?.DeepClone(), ["result"] = result });

    public static ProviderCallbackResponse Error(JsonNode? id, int code, string? data = null)
    {
        var (ru, uz, en) = Messages[code];
        var error = new JsonObject
        {
            ["code"] = code,
            ["message"] = new JsonObject { ["ru"] = ru, ["uz"] = uz, ["en"] = en },
        };
        if (data is not null)
        {
            error["data"] = data;
        }

        return Write(new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id?.DeepClone(), ["error"] = error });
    }

    public static long ToTiyin(decimal amount) => (long)decimal.Round(amount * 100m, 0, MidpointRounding.AwayFromZero);

    public static long ToUnixMs(DateTime? utc) =>
        utc is { } value ? new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc)).ToUnixTimeMilliseconds() : 0L;

    public static bool TryGetLong(JsonObject? parameters, string name, out long value)
    {
        value = 0;
        return parameters?[name] is JsonValue node && node.GetValueKind() == JsonValueKind.Number && node.TryGetValue(out value);
    }

    public static bool TryGetDecimal(JsonObject? parameters, string name, out decimal value)
    {
        value = 0;
        return parameters?[name] is JsonValue node && node.GetValueKind() == JsonValueKind.Number && node.TryGetValue(out value);
    }

    public static string? GetString(JsonObject? parameters, string name) =>
        parameters?[name] is JsonValue node && node.GetValueKind() == JsonValueKind.String ? node.GetValue<string>() : null;

    private static ProviderCallbackResponse Write(JsonObject body) => new(200, body.ToJsonString());
}
