using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Common.Options;
using Restaurant.Application.Features.Payments.Providers;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;
using static Restaurant.Infrastructure.Payments.PaymeProtocol;

namespace Restaurant.Infrastructure.Payments;

/// <summary>
/// Payme Merchant API adapter: CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction,
/// CheckTransaction, GetStatement over JSON-RPC with Basic auth <c>Paycom:&lt;key&gt;</c>. The account field
/// (<c>PaymentProviders:Payme:AccountField</c>, default <c>order_id</c>) carries the payment intent id. Performed transactions
/// cannot be cancelled by Payme (−31007: the restaurant service is delivered; refunds go through the cashier).
/// </summary>
internal sealed class PaymeProvider(IOptions<PaymentProvidersOptions> options, PaymentIntentLedger ledger, ILogger<PaymeProvider> logger)
    : OnlineProviderBase, IOnlinePaymentProvider
{
    public const string ProviderCode = "payme";

    private PaymeOptions Config => options.Value.Payme;

    public override string Code => ProviderCode;

    public PaymentProviderStatus Status =>
        !Config.IsConfigured ? PaymentProviderStatus.NotConnected : Config.TestMode ? PaymentProviderStatus.Test : PaymentProviderStatus.Connected;

    public bool IsImplemented => true;

    /// <summary>Checkout link: <c>{checkout}/base64("m=…;ac.order_id=…;a=…")</c> (amount in tiyin).</summary>
    public string CreatePaymentUrl(PaymentLinkRequest request)
    {
        var raw = $"m={Config.MerchantId};ac.{Config.AccountField}={request.IntentId};a={ToTiyin(request.TotalAmount)}";
        var baseUrl = Config.TestMode ? Config.TestCheckoutUrl : Config.CheckoutUrl;
        return $"{baseUrl.TrimEnd('/')}/{Convert.ToBase64String(Encoding.UTF8.GetBytes(raw))}";
    }

    public async Task<ProviderCallbackResponse> HandleCallbackAsync(ProviderCallbackRequest request, CancellationToken cancellationToken)
    {
        if (!IsAuthorized(request.Authorization))
        {
            logger.LogWarning("Payme callback rejected: invalid Basic credentials");
            return Error(null, InsufficientPrivileges);
        }

        JsonObject? body;
        try
        {
            body = JsonNode.Parse(request.Body) as JsonObject;
        }
        catch (JsonException)
        {
            return Error(null, ParseError);
        }

        var id = body?["id"];
        var parameters = body?["params"] as JsonObject;
        if (body?["method"] is not JsonValue methodNode || parameters is null)
        {
            return Error(id, InvalidRequest);
        }

        return methodNode.ToString() switch
        {
            "CheckPerformTransaction" => await CheckPerformAsync(id, parameters, cancellationToken),
            "CreateTransaction" => await CreateAsync(id, parameters, cancellationToken),
            "PerformTransaction" => await PerformAsync(id, parameters, cancellationToken),
            "CancelTransaction" => await CancelAsync(id, parameters, cancellationToken),
            "CheckTransaction" => await CheckAsync(id, parameters, cancellationToken),
            "GetStatement" => await StatementAsync(id, parameters, cancellationToken),
            _ => Error(id, MethodNotFound),
        };
    }

    private bool IsAuthorized(string? header)
    {
        const string scheme = "Basic ";
        if (header is null || !header.StartsWith(scheme, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        byte[] provided;
        try
        {
            provided = Convert.FromBase64String(header[scheme.Length..].Trim());
        }
        catch (FormatException)
        {
            return false;
        }

        var expected = Encoding.UTF8.GetBytes($"{Config.Login}:{Config.Key}");
        return CryptographicOperations.FixedTimeEquals(provided, expected);
    }

    private async Task<ProviderCallbackResponse> CheckPerformAsync(JsonNode? id, JsonObject parameters, CancellationToken ct)
    {
        var (intent, error) = await ResolveAccountAsync(id, parameters, ct);
        return intent is null ? error! : Result(id, new JsonObject { ["allow"] = true });
    }

    private async Task<ProviderCallbackResponse> CreateAsync(JsonNode? id, JsonObject parameters, CancellationToken ct)
    {
        var transactionId = GetString(parameters, "id");
        if (transactionId is null || !TryGetLong(parameters, "time", out var time))
        {
            return Error(id, InvalidRequest);
        }

        var existing = await ledger.FindByTransactionAsync(Code, transactionId, ct);
        if (existing is not null)
        {
            if (existing.ProviderState != PaymentIntent.StateCreated)
            {
                return Error(id, CannotPerform);
            }

            return await IsTimedOutAsync(existing, ct) ? Error(id, CannotPerform) : Result(id, CreateResult(existing));
        }

        var (intent, error) = await ResolveAccountAsync(id, parameters, ct);
        if (intent is null)
        {
            return error!;
        }

        intent.AttachTransaction(transactionId, time, null, ledger.UtcNow);
        await ledger.SaveAsync(intent, "payment.provider_transaction_created", ct);
        return Result(id, CreateResult(intent));
    }

    private async Task<ProviderCallbackResponse> PerformAsync(JsonNode? id, JsonObject parameters, CancellationToken ct)
    {
        var intent = await FindTransactionAsync(parameters, ct);
        if (intent is null)
        {
            return Error(id, TransactionNotFound);
        }

        if (intent.ProviderState == PaymentIntent.StateCreated)
        {
            if (await IsTimedOutAsync(intent, ct))
            {
                return Error(id, CannotPerform);
            }

            if (!await ledger.CompleteAsync(intent, ct))
            {
                intent.Cancel(ReasonExecutionError, ledger.UtcNow);
                await ledger.SaveAsync(intent, "payment.provider_transaction_cancelled", ct);
                return Error(id, CannotPerform);
            }
        }

        if (intent.ProviderState != PaymentIntent.StatePerformed)
        {
            return Error(id, CannotPerform);
        }

        return Result(id, new JsonObject
        {
            ["transaction"] = intent.Id.ToString(), ["perform_time"] = ToUnixMs(intent.PerformedAt), ["state"] = intent.ProviderState,
        });
    }

    private async Task<ProviderCallbackResponse> CancelAsync(JsonNode? id, JsonObject parameters, CancellationToken ct)
    {
        var intent = await FindTransactionAsync(parameters, ct);
        if (intent is null)
        {
            return Error(id, TransactionNotFound);
        }

        if (intent.Status == PaymentIntentStatus.Completed)
        {
            return Error(id, CannotCancel);
        }

        if (intent.Status == PaymentIntentStatus.Pending)
        {
            intent.Cancel(TryGetLong(parameters, "reason", out var reason) ? (int)reason : null, ledger.UtcNow);
            await ledger.SaveAsync(intent, "payment.provider_transaction_cancelled", ct);
        }

        return Result(id, new JsonObject
        {
            ["transaction"] = intent.Id.ToString(), ["cancel_time"] = ToUnixMs(intent.CancelledAt), ["state"] = intent.ProviderState,
        });
    }

    private async Task<ProviderCallbackResponse> CheckAsync(JsonNode? id, JsonObject parameters, CancellationToken ct)
    {
        var intent = await FindTransactionAsync(parameters, ct);
        return intent is null ? Error(id, TransactionNotFound) : Result(id, TransactionResult(intent));
    }

    private async Task<ProviderCallbackResponse> StatementAsync(JsonNode? id, JsonObject parameters, CancellationToken ct)
    {
        if (!TryGetLong(parameters, "from", out var from) || !TryGetLong(parameters, "to", out var to))
        {
            return Error(id, InvalidRequest);
        }

        var transactions = new JsonArray();
        foreach (var intent in await ledger.StatementAsync(Code, from, to, ct))
        {
            var row = TransactionResult(intent);
            row["id"] = intent.ProviderTransactionId;
            row["time"] = intent.ProviderTime;
            row["amount"] = ToTiyin(intent.TotalAmount);
            row["account"] = new JsonObject { [Config.AccountField] = intent.Id.ToString() };
            transactions.Add(row);
        }

        return Result(id, new JsonObject { ["transactions"] = transactions });
    }

    /// <summary>Account → pending, active intent whose order can take it and whose total equals <c>amount</c>.</summary>
    private async Task<(PaymentIntent? Intent, ProviderCallbackResponse? Error)> ResolveAccountAsync(
        JsonNode? id, JsonObject parameters, CancellationToken ct)
    {
        if (!TryGetDecimal(parameters, "amount", out var amount))
        {
            return (null, Error(id, InvalidAmount));
        }

        var accountValue = (parameters["account"] as JsonObject)?[Config.AccountField]?.ToString();
        var intent = Guid.TryParse(accountValue, out var intentId) ? await ledger.FindAsync(intentId, Code, ct) : null;
        if (intent is null || !intent.IsActive(ledger.UtcNow) || !await ledger.CanAcceptAsync(intent, ct))
        {
            return (null, Error(id, OrderNotFound, Config.AccountField));
        }

        if (amount != ToTiyin(intent.TotalAmount))
        {
            return (null, Error(id, InvalidAmount));
        }

        return intent.ProviderTransactionId is not null ? (null, Error(id, OrderBusy, Config.AccountField)) : (intent, null);
    }

    private async Task<PaymentIntent?> FindTransactionAsync(JsonObject parameters, CancellationToken ct) =>
        GetString(parameters, "id") is { } transactionId ? await ledger.FindByTransactionAsync(Code, transactionId, ct) : null;

    /// <summary>Cancels (reason 4) a created transaction older than the Payme timeout.</summary>
    private async Task<bool> IsTimedOutAsync(PaymentIntent intent, CancellationToken ct)
    {
        if (intent.ProviderCreatedAt is not { } created || created.AddMinutes(Config.TransactionTimeoutMinutes) > ledger.UtcNow)
        {
            return false;
        }

        intent.Cancel(ReasonTimeout, ledger.UtcNow);
        await ledger.SaveAsync(intent, "payment.provider_transaction_cancelled", ct);
        return true;
    }

    private static JsonObject CreateResult(PaymentIntent intent) => new()
    {
        ["create_time"] = ToUnixMs(intent.ProviderCreatedAt), ["transaction"] = intent.Id.ToString(), ["state"] = intent.ProviderState,
    };

    private static JsonObject TransactionResult(PaymentIntent intent) => new()
    {
        ["create_time"] = ToUnixMs(intent.ProviderCreatedAt),
        ["perform_time"] = ToUnixMs(intent.PerformedAt),
        ["cancel_time"] = ToUnixMs(intent.CancelledAt),
        ["transaction"] = intent.Id.ToString(),
        ["state"] = intent.ProviderState,
        ["reason"] = intent.CancelReason,
    };
}
