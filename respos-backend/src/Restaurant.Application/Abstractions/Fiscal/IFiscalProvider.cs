using Restaurant.Domain.Enums;

namespace Restaurant.Application.Abstractions.Fiscal;

public sealed record FiscalReceiptRequest(Guid OrderId, Guid PaymentId, decimal Amount, string Currency);

public sealed record FiscalReceiptResult(bool Registered, string? FiscalSign, string? ErrorCode);

/// <summary>Fiscal receipt adapter (online cash register / OFD). MVP: <c>none</c> — receipts are not fiscal.</summary>
public interface IFiscalProvider
{
    string Code { get; }

    PaymentProviderStatus Status { get; }

    Task<FiscalReceiptResult> RegisterAsync(FiscalReceiptRequest request, CancellationToken cancellationToken = default);
}
