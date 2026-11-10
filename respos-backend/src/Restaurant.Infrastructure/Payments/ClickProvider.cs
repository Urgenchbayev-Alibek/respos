using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Common.Options;
using Restaurant.Application.Features.Payments.Providers;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Infrastructure.Payments;

/// <summary>
/// Click SHOP API adapter (docs.click.uz): one callback URL handles Prepare (<c>action=0</c>) and Complete (<c>action=1</c>),
/// form-encoded, verified by <c>sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id
/// [+ merchant_prepare_id] + amount + action + sign_time)</c>. <c>merchant_trans_id</c> = payment intent id. Retries are idempotent.
/// </summary>
internal sealed class ClickProvider(IOptions<PaymentProvidersOptions> options, PaymentIntentLedger ledger, ILogger<ClickProvider> logger)
    : OnlineProviderBase, IOnlinePaymentProvider
{
    public const string ProviderCode = "click";

    public const int Success = 0;
    public const int SignFailed = -1;
    public const int InvalidAmount = -2;
    public const int ActionNotFound = -3;
    public const int AlreadyPaid = -4;
    public const int OrderNotFound = -5;
    public const int TransactionNotFound = -6;
    public const int BadRequest = -8;
    public const int TransactionCancelled = -9;

    private ClickOptions Config => options.Value.Click;

    public override string Code => ProviderCode;

    public PaymentProviderStatus Status =>
        !Config.IsConfigured ? PaymentProviderStatus.NotConnected : Config.TestMode ? PaymentProviderStatus.Test : PaymentProviderStatus.Connected;

    public bool IsImplemented => true;

    public string CreatePaymentUrl(PaymentLinkRequest request) =>
        $"{Config.PayUrl}?service_id={Uri.EscapeDataString(Config.ServiceId ?? string.Empty)}" +
        $"&merchant_id={Uri.EscapeDataString(Config.MerchantId ?? string.Empty)}" +
        $"&amount={request.TotalAmount.ToString("0.00", CultureInfo.InvariantCulture)}&transaction_param={request.IntentId}";

    /// <summary>md5 hex (lowercase) of the concatenated fields, as Click computes it.</summary>
    public static string Sign(params string[] parts) =>
        Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(string.Concat(parts)))).ToLowerInvariant();

    public async Task<ProviderCallbackResponse> HandleCallbackAsync(ProviderCallbackRequest request, CancellationToken cancellationToken)
    {
        string F(string name) => request.Form.TryGetValue(name, out var value) ? value : string.Empty;
        var (clickTransId, serviceId, merchantTransId, amountText, action, signTime) =
            (F("click_trans_id"), F("service_id"), F("merchant_trans_id"), F("amount"), F("action"), F("sign_time"));
        var reply = new Reply(clickTransId, merchantTransId);
        if (action is not ("0" or "1"))
        {
            return reply.Error(ActionNotFound, "Action not found");
        }

        var prepareId = F("merchant_prepare_id");
        var secret = Config.SecretKey ?? string.Empty;
        var expected = action == "0"
            ? Sign(clickTransId, serviceId, secret, merchantTransId, amountText, action, signTime)
            : Sign(clickTransId, serviceId, secret, merchantTransId, prepareId, amountText, action, signTime);
        var provided = Encoding.ASCII.GetBytes(F("sign_string").ToLowerInvariant());
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), provided))
        {
            logger.LogWarning("Click callback rejected: SIGN CHECK FAILED");
            return reply.Error(SignFailed, "SIGN CHECK FAILED!");
        }

        if (serviceId != Config.ServiceId || clickTransId.Length == 0
            || !decimal.TryParse(amountText, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount))
        {
            return reply.Error(BadRequest, "Error in request from click");
        }

        var intent = Guid.TryParse(merchantTransId, out var intentId) ? await ledger.FindAsync(intentId, Code, cancellationToken) : null;
        if (intent is null)
        {
            return reply.Error(OrderNotFound, "Order does not exist");
        }

        if (action == "0")
        {
            return await PrepareAsync(intent, reply, clickTransId, amount, cancellationToken);
        }

        var clickError = int.TryParse(F("error"), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var e) ? e : 0;
        return await CompleteAsync(intent, reply, clickTransId, prepareId, amount, clickError, cancellationToken);
    }

    private async Task<ProviderCallbackResponse> PrepareAsync(
        PaymentIntent intent, Reply reply, string clickTransId, decimal amount, CancellationToken ct)
    {
        if (intent.Status == PaymentIntentStatus.Completed)
        {
            return reply.Error(AlreadyPaid, "Already paid");
        }

        if (intent.Status == PaymentIntentStatus.Cancelled || !intent.IsActive(ledger.UtcNow) || !await ledger.CanAcceptAsync(intent, ct))
        {
            return reply.Error(TransactionCancelled, "Transaction cancelled");
        }

        if (amount != intent.TotalAmount)
        {
            return reply.Error(InvalidAmount, "Incorrect parameter amount");
        }

        if (intent.ProviderTransactionId != clickTransId || intent.ProviderPrepareId is null)
        {
            var prepareId = intent.ProviderPrepareId ?? RandomNumberGenerator.GetInt32(1, int.MaxValue);
            intent.AttachTransaction(clickTransId, null, prepareId, ledger.UtcNow, allowReplace: true);
            await ledger.SaveAsync(intent, "payment.provider_transaction_created", ct);
        }

        return reply.Ok("merchant_prepare_id", intent.ProviderPrepareId!.Value);
    }

    private async Task<ProviderCallbackResponse> CompleteAsync(
        PaymentIntent intent, Reply reply, string clickTransId, string prepareIdText, decimal amount, int clickError, CancellationToken ct)
    {
        if (!long.TryParse(prepareIdText, NumberStyles.None, CultureInfo.InvariantCulture, out var prepareId)
            || intent.ProviderPrepareId != prepareId || intent.ProviderTransactionId != clickTransId)
        {
            return reply.Error(TransactionNotFound, "Transaction does not exist");
        }

        if (intent.Status == PaymentIntentStatus.Completed)
        {
            return reply.Ok("merchant_confirm_id", prepareId);
        }

        if (intent.Status == PaymentIntentStatus.Cancelled)
        {
            return reply.Error(TransactionCancelled, "Transaction cancelled");
        }

        if (amount != intent.TotalAmount)
        {
            return reply.Error(InvalidAmount, "Incorrect parameter amount");
        }

        if (clickError < 0 || !await ledger.CompleteAsync(intent, ct))
        {
            intent.Cancel(clickError < 0 ? clickError : null, ledger.UtcNow);
            await ledger.SaveAsync(intent, "payment.provider_transaction_cancelled", ct);
            return reply.Error(TransactionCancelled, "Transaction cancelled");
        }

        return reply.Ok("merchant_confirm_id", prepareId);
    }

    private sealed record Reply(string ClickTransId, string MerchantTransId)
    {
        public ProviderCallbackResponse Ok(string idField, long id) => Write(Success, "Success", (idField, id));

        public ProviderCallbackResponse Error(int code, string note) => Write(code, note, null);

        private ProviderCallbackResponse Write(int code, string note, (string Field, long Value)? id)
        {
            var body = new JsonObject
            {
                ["click_trans_id"] = long.TryParse(ClickTransId, NumberStyles.None, CultureInfo.InvariantCulture, out var trans) ? trans : null,
                ["merchant_trans_id"] = MerchantTransId,
                ["error"] = code,
                ["error_note"] = note,
            };
            if (id is { } value)
            {
                body[value.Field] = value.Value;
            }

            return new ProviderCallbackResponse(200, body.ToJsonString());
        }
    }
}
