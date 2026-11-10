using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.SplitBill;

public sealed record SplitBillItemRequest(Guid OrderItemId, decimal Quantity);

public sealed record SplitBillRequest(IReadOnlyList<SplitBillItemRequest> Items);

/// <summary>
/// <c>POST /orders/{id}/split</c>: <c>equal</c> → <c>parts</c>; <c>custom</c> → <c>amounts</c> (Σ == total);
/// <c>items</c> → <c>bills[].items[{orderItemId, quantity}]</c>, unallocated quantities form one extra last bill.
/// </summary>
public sealed record SplitOrderCommand(BillSplitMode Mode, int? Parts, IReadOnlyList<decimal>? Amounts, IReadOnlyList<SplitBillRequest>? Bills)
{
    [JsonIgnore]
    public Guid OrderId { get; init; }
}

public sealed class SplitOrderValidator : AbstractValidator<SplitOrderCommand>
{
    public SplitOrderValidator()
    {
        RuleFor(x => x.Mode).IsInEnum();
        When(x => x.Mode == BillSplitMode.Equal, () =>
            RuleFor(x => x.Parts).NotNull().InclusiveBetween(2, BillSplitter.MaxBills));
        When(x => x.Mode == BillSplitMode.Custom, () =>
        {
            RuleFor(x => x.Amounts).NotNull().Must(a => a!.Count is >= 2 and <= BillSplitter.MaxBills)
                .WithMessage($"Between 2 and {BillSplitter.MaxBills} amounts are required.");
            RuleForEach(x => x.Amounts).GreaterThan(0m).PrecisionScale(18, 2, true);
        });
        When(x => x.Mode == BillSplitMode.Items, () =>
        {
            RuleFor(x => x.Bills).NotNull().Must(b => b!.Count is >= 1 and <= BillSplitter.MaxBills)
                .WithMessage($"Between 1 and {BillSplitter.MaxBills} bills are required.");
            RuleForEach(x => x.Bills).ChildRules(bill =>
            {
                bill.RuleFor(b => b.Items).NotEmpty();
                bill.RuleForEach(b => b.Items).ChildRules(item =>
                {
                    item.RuleFor(i => i.OrderItemId).NotEmpty();
                    item.RuleFor(i => i.Quantity).GreaterThan(0m).PrecisionScale(18, 3, true);
                });
            });
        });
    }
}

/// <summary>Loads the tracked order with items + bills (current branch) for split/merge.</summary>
[ScopedService]
public sealed class BillOrderLoader(IApplicationDbContext db, ITenantContext tenant)
{
    public Task<Order?> LoadAsync(Guid orderId, CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        return db.Orders
            .Include(o => o.Items)
            .Include(o => o.Bills).ThenInclude(b => b.Items)
            .AsSplitQuery()
            .FirstOrDefaultAsync(o => o.Id == orderId && o.BranchId == branchId, ct);
    }
}

/// <summary>
/// Splits an open unpaid order into 2–20 bills [orders.split]. Errors: 404 <c>order.not_found</c> / <c>order.item_not_found</c>,
/// 409 <c>order.already_split</c> / <c>order.closed</c>, 422 <c>order.has_payments</c>, <c>order.invalid_split</c>, <c>order.split_mismatch</c>.
/// </summary>
public sealed class SplitOrderHandler(BillOrderLoader loader, IAuditLogger audit, OrderWriter writer)
    : IHandler<SplitOrderCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(SplitOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await loader.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var bills = request.Mode switch
        {
            BillSplitMode.Equal => order.SplitEqually(request.Parts ?? 0),
            BillSplitMode.Custom => order.SplitByAmounts(request.Amounts ?? []),
            _ => order.SplitByItems((request.Bills ?? [])
                .Select(b => (IReadOnlyList<BillItemAllocation>)b.Items.Select(i => new BillItemAllocation(i.OrderItemId, i.Quantity)).ToList())
                .ToList()),
        };
        audit.Log("order.split", nameof(Order), order.Id, new
        {
            request.Mode, order.Total, bills = bills.Select(b => new { b.Number, b.Amount }).ToList(),
        });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}

public sealed record MergeBillsCommand(Guid OrderId);

/// <summary>
/// <c>DELETE /orders/{id}/split</c> [orders.split]: un-split when no payment (even refunded) references a bill → else 422
/// <c>order.has_payments</c>; 409 <c>payment.intent_pending</c> while an online payment is pending (cancelled intents lose the bill link).
/// </summary>
public sealed class MergeBillsHandler(
    IApplicationDbContext db, BillOrderLoader loader, PaymentRecorder recorder, IAuditLogger audit, OrderWriter writer)
    : IHandler<MergeBillsCommand, OrderDto>
{
    public async Task<Result<OrderDto>> HandleAsync(MergeBillsCommand request, CancellationToken cancellationToken)
    {
        var order = await loader.LoadAsync(request.OrderId, cancellationToken);
        if (order is null)
        {
            return OrderErrors.NotFound;
        }

        var billIds = order.Bills.Select(b => b.Id).ToList();
        if (await db.Payments.AnyAsync(p => p.BillId != null && billIds.Contains(p.BillId.Value), cancellationToken))
        {
            return OrderErrors.HasPayments;
        }

        if (await recorder.HasActiveIntentAsync(order.Id, null, cancellationToken))
        {
            return PaymentIntentErrors.Pending;
        }

        order.MergeBills();
        audit.Log("order.bills_merged", nameof(Order), order.Id, new { bills = billIds.Count });
        writer.NotifyOrderUpdated(order);
        return await writer.SaveAndReadAsync(order, cancellationToken);
    }
}
