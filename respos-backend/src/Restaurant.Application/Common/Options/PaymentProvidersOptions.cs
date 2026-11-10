namespace Restaurant.Application.Common.Options;

/// <summary>
/// Section <c>PaymentProviders</c>. Credentials come from env only (e.g. <c>PaymentProviders__Payme__Key</c>), never from the repo.
/// A provider without credentials reports «Не подключено» and cannot be enabled for a branch.
/// </summary>
public sealed class PaymentProvidersOptions
{
    public const string SectionName = "PaymentProviders";

    /// <summary>How long a new payment link stays valid for the customer.</summary>
    public int IntentLifetimeMinutes { get; set; } = 15;

    public PaymeOptions Payme { get; set; } = new();
    public ClickOptions Click { get; set; } = new();
    public UzumOptions Uzum { get; set; } = new();
}

/// <summary>Payme Merchant API (JSON-RPC, Basic auth <c>Paycom:&lt;Key&gt;</c>).</summary>
public sealed class PaymeOptions
{
    public string? MerchantId { get; set; }

    /// <summary>Cash-desk key (test key in test mode). Secret.</summary>
    public string? Key { get; set; }

    public bool TestMode { get; set; } = true;
    public string Login { get; set; } = "Paycom";

    /// <summary>Account field configured in the Payme cabinet (value = payment intent id).</summary>
    public string AccountField { get; set; } = "order_id";
    public string CheckoutUrl { get; set; } = "https://checkout.paycom.uz";
    public string TestCheckoutUrl { get; set; } = "https://checkout.test.paycom.uz";

    /// <summary>Payme transaction timeout (docs: 12 h).</summary>
    public int TransactionTimeoutMinutes { get; set; } = 720;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(MerchantId) && !string.IsNullOrWhiteSpace(Key);
}

/// <summary>Click SHOP API (Prepare/Complete with md5 sign).</summary>
public sealed class ClickOptions
{
    public string? ServiceId { get; set; }
    public string? MerchantId { get; set; }

    /// <summary>Secret key for <c>sign_string</c>. Secret.</summary>
    public string? SecretKey { get; set; }

    public bool TestMode { get; set; } = true;
    public string PayUrl { get; set; } = "https://my.click.uz/services/pay";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ServiceId) && !string.IsNullOrWhiteSpace(MerchantId) && !string.IsNullOrWhiteSpace(SecretKey);
}

/// <summary>Uzum: adapter skeleton only (public merchant API not verified) — never enabled, see ADR-0008 / F2 contract.</summary>
public sealed class UzumOptions
{
    public string? ServiceId { get; set; }
    public string? SecretKey { get; set; }
    public string CheckoutUrl { get; set; } = string.Empty;
}
