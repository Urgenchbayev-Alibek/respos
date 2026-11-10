using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Orders;

/// <summary>
/// Split bill (F2). Split only an open, unpaid order with total &gt; 0; Σ bills == total (remainder → last bill).
/// While split, items and the discount are locked (<c>order.split_active</c>); payments must name a bill.
/// The order becomes <c>paid</c> through the usual rule (paidAmount == total), i.e. when every bill is paid.
/// </summary>
public partial class Order
{
    /// <summary>True while the order has bills (persisted flag so item handlers need not load bills).</summary>
    public bool IsSplit { get; private set; }

    public List<OrderBill> Bills { get; private set; } = [];

    public IReadOnlyList<OrderBill> SplitEqually(int parts)
    {
        EnsureSplittable();
        return CreateBills(BillSplitMode.Equal, BillSplitter.Equal(Total, parts), null);
    }

    public IReadOnlyList<OrderBill> SplitByAmounts(IReadOnlyList<decimal> amounts)
    {
        EnsureSplittable();
        return CreateBills(BillSplitMode.Custom, BillSplitter.Custom(Total, amounts), null);
    }

    /// <summary>
    /// Allocates item quantities to bills; unallocated quantities form one extra last bill. Amounts are the bill's
    /// share of the line totals applied to the order total (so discount/service/tax are distributed proportionally).
    /// </summary>
    public IReadOnlyList<OrderBill> SplitByItems(IReadOnlyList<IReadOnlyList<BillItemAllocation>> bills)
    {
        EnsureSplittable();
        var active = Items.Where(i => i.Status != OrderItemStatus.Cancelled).ToDictionary(i => i.Id);
        var allocated = active.Keys.ToDictionary(id => id, _ => 0m);
        var groups = new List<List<BillItemAllocation>>();
        foreach (var bill in bills)
        {
            var merged = bill.GroupBy(a => a.OrderItemId).Select(g => new BillItemAllocation(g.Key, g.Sum(a => a.Quantity))).ToList();
            if (merged.Count == 0 || merged.Any(a => a.Quantity <= 0))
            {
                throw new DomainException(OrderBillErrors.InvalidSplit);
            }

            foreach (var allocation in merged)
            {
                if (!active.ContainsKey(allocation.OrderItemId))
                {
                    throw new DomainException(OrderErrors.ItemNotFound);
                }

                allocated[allocation.OrderItemId] += allocation.Quantity;
            }

            groups.Add(merged);
        }

        if (allocated.Any(a => a.Value > active[a.Key].Quantity))
        {
            throw new DomainException(OrderBillErrors.InvalidSplit);
        }

        var rest = allocated.Where(a => a.Value < active[a.Key].Quantity)
            .Select(a => new BillItemAllocation(a.Key, active[a.Key].Quantity - a.Value))
            .ToList();
        if (rest.Count > 0)
        {
            groups.Add(rest);
        }

        decimal Share(BillItemAllocation a) => active[a.OrderItemId].LineTotal * a.Quantity / active[a.OrderItemId].Quantity;
        var amounts = BillSplitter.Proportional(Total, groups.Select(g => g.Sum(Share)).ToList());
        return CreateBills(BillSplitMode.Items, amounts, groups.Select(g => (IReadOnlyList<(Guid, decimal, decimal)>)g
            .Select(a => (a.OrderItemId, a.Quantity, Money.Round(Share(a)))).ToList()).ToList());
    }

    /// <summary>Un-split: only when nothing was paid (handlers also check that no payment row references a bill).</summary>
    public void MergeBills()
    {
        EnsureNotClosed();
        if (!IsSplit)
        {
            throw new DomainException(OrderBillErrors.NotSplit);
        }

        if (PaidAmount != 0 || Bills.Any(b => b.PaidAmount != 0))
        {
            throw new DomainException(OrderErrors.HasPayments);
        }

        Bills.Clear();
        IsSplit = false;
    }

    public OrderBill GetBill(Guid billId) =>
        (IsSplit ? Bills.FirstOrDefault(b => b.Id == billId) : null) ?? throw new DomainException(OrderBillErrors.BillNotFound);

    /// <summary>Pays (part of) one bill; the order-level rules of <see cref="RegisterPayment"/> apply as well.</summary>
    public void RegisterBillPayment(Guid billId, decimal amount, Guid? changedBy, DateTime utcNow)
    {
        var bill = GetBill(billId);
        if (amount <= 0)
        {
            throw new DomainException(OrderErrors.InvalidPaymentAmount);
        }

        if (IsClosed)
        {
            throw new DomainException(OrderErrors.NotPayable(Status));
        }

        if (bill.Status == OrderBillStatus.Paid)
        {
            throw new DomainException(OrderBillErrors.BillPaid);
        }

        if (amount > bill.RemainingAmount)
        {
            throw new DomainException(OrderErrors.PaymentExceedsDue);
        }

        bill.PaidAmount += amount;
        if (bill.PaidAmount == bill.Amount)
        {
            bill.Status = OrderBillStatus.Paid;
        }

        ApplyPayment(amount, changedBy, utcNow);
    }

    /// <summary>Refund of a bill payment: the bill re-opens unless the order is already closed (paid stays paid).</summary>
    public void RegisterBillRefund(Guid billId, decimal amount)
    {
        var bill = GetBill(billId);
        RegisterRefund(amount);
        bill.PaidAmount -= amount;
        if (!IsClosed && bill.PaidAmount < bill.Amount)
        {
            bill.Status = OrderBillStatus.Open;
        }
    }

    private void EnsureNotSplit()
    {
        if (IsSplit)
        {
            throw new DomainException(OrderBillErrors.SplitActive);
        }
    }

    private void EnsureSplittable()
    {
        EnsureNotClosed();
        if (IsSplit)
        {
            throw new DomainException(OrderBillErrors.AlreadySplit);
        }

        if (PaidAmount != 0)
        {
            throw new DomainException(OrderErrors.HasPayments);
        }

        if (Total <= 0)
        {
            throw new DomainException(OrderBillErrors.InvalidSplit);
        }
    }

    private IReadOnlyList<OrderBill> CreateBills(
        BillSplitMode mode, IReadOnlyList<decimal> amounts, IReadOnlyList<IReadOnlyList<(Guid ItemId, decimal Quantity, decimal Amount)>>? items)
    {
        for (var i = 0; i < amounts.Count; i++)
        {
            var bill = new OrderBill { OrderId = Id, Number = i + 1, Mode = mode, Amount = amounts[i] };
            if (items is not null)
            {
                bill.Items.AddRange(items[i].Select(a => new OrderBillItem
                {
                    BillId = bill.Id, OrderItemId = a.ItemId, Quantity = a.Quantity, Amount = a.Amount,
                }));
            }

            Bills.Add(bill);
        }

        IsSplit = true;
        return Bills;
    }
}
