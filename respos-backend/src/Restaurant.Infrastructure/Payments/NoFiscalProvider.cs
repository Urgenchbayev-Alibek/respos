using Restaurant.Application.Abstractions.Fiscal;
using Restaurant.Domain.Enums;

namespace Restaurant.Infrastructure.Payments;

/// <summary>Fiscalization is not connected: receipts are pre-checks («Не является фискальным чеком»). Settings show «Не подключено».</summary>
internal sealed class NoFiscalProvider : IFiscalProvider
{
    public string Code => "none";

    public IntegrationStatus Status => IntegrationStatus.NotConnected;

    public Task<FiscalReceiptResult> RegisterAsync(FiscalReceiptRequest request, CancellationToken cancellationToken = default) =>
        Task.FromResult(new FiscalReceiptResult(false, null, "fiscal.not_connected"));
}
