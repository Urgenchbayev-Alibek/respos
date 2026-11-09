using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.GetReceipt;

public sealed record GetReceiptQuery(Guid OrderId);

public sealed record ReceiptPaymentDto(PaymentMethod Method, decimal Amount, decimal RefundedAmount);

/// <summary>Printable pre-check (BR-10.10). NOT a fiscal receipt: <see cref="IsFiscal"/> is always false.</summary>
public sealed record ReceiptDto(
    Guid OrderId,
    int Number,
    string DisplayNumber,
    OrderType Type,
    OrderStatus Status,
    string? TableNumber,
    string? WaiterName,
    int GuestCount,
    string OrganizationName,
    string Currency,
    string BranchName,
    string? BranchAddress,
    string? BranchPhone,
    IReadOnlyList<OrderItemDto> Items,
    decimal Subtotal,
    DiscountType DiscountType,
    decimal DiscountValue,
    decimal DiscountAmount,
    decimal ServiceChargePercent,
    decimal ServiceChargeAmount,
    decimal TaxPercent,
    decimal TaxAmount,
    decimal Total,
    decimal PaidAmount,
    decimal RemainingAmount,
    IReadOnlyList<ReceiptPaymentDto> Payments,
    DateTime OpenedAt,
    DateTime? ClosedAt,
    DateTime PrintedAt,
    string? Footer,
    bool IsFiscal,
    string FiscalNotice);

/// <summary><c>GET /orders/{id}/receipt</c>: pre-check data (cancelled items excluded), marked "Не является фискальным чеком".</summary>
public sealed class GetReceiptHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, OrderReadService reader)
    : IHandler<GetReceiptQuery, ReceiptDto>
{
    public const string FiscalNotice = "Не является фискальным чеком";

    public async Task<Result<ReceiptDto>> HandleAsync(GetReceiptQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var order = await reader.GetAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var branch = await db.Branches.AsNoTracking()
            .Where(b => b.Id == branchId)
            .Select(b => new
            {
                b.Name, b.Address, b.Phone,
                OrganizationName = b.Organization!.Name,
                Currency = b.Organization!.Currency,
                Service = b.Settings != null ? b.Settings.ServiceChargePercent : 0m,
                Tax = b.Settings != null ? b.Settings.TaxPercent : 0m,
                Footer = b.Settings != null ? b.Settings.ReceiptFooter : null,
            })
            .FirstAsync(cancellationToken);

        return new ReceiptDto(
            order.Id, order.Number, $"#{order.Number:0000}", order.Type, order.Status, order.TableNumber, order.WaiterName, order.GuestCount,
            branch.OrganizationName, branch.Currency, branch.Name, branch.Address, branch.Phone,
            order.Items.Where(i => i.Status != OrderItemStatus.Cancelled).ToList(),
            order.Subtotal, order.DiscountType, order.DiscountValue, order.DiscountAmount,
            branch.Service, order.ServiceChargeAmount, branch.Tax, order.TaxAmount, order.Total, order.PaidAmount, order.RemainingAmount,
            order.Payments.Select(p => new ReceiptPaymentDto(p.Method, p.Amount, p.RefundedAmount)).ToList(),
            order.OpenedAt, order.ClosedAt, clock.UtcNow, branch.Footer, IsFiscal: false, FiscalNotice);
    }
}
