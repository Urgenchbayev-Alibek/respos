using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Reports;

public sealed record TestMenu(Guid CategoryId, MenuItem Plov, MenuItem Tea, Guid ShiftId);

/// <summary>Builds paid orders + payments/refunds directly through the domain (independent of the Orders/Payments API).</summary>
public sealed class SalesTestData(TestOrg org)
{
    private int _number;

    public static async Task<TestMenu> SeedMenuAsync(AppDbContext db, TestOrg org, DateTime shiftOpenedAt)
    {
        var category = new MenuCategory { OrganizationId = org.OrganizationId, Name = "Основное" };
        var plov = new MenuItem { OrganizationId = org.OrganizationId, CategoryId = category.Id, Name = "Плов", Price = 50_000m };
        var tea = new MenuItem { OrganizationId = org.OrganizationId, CategoryId = category.Id, Name = "=Чай", Price = 10_000m };
        var shift = new CashShift
        {
            OrganizationId = org.OrganizationId,
            BranchId = org.BranchId,
            OpenedBy = org.User.Id,
            OpenedAt = shiftOpenedAt,
            OpeningAmount = 100_000m,
        };
        db.AddRange(category, plov, tea, shift);
        await db.SaveChangesAsync();
        return new TestMenu(category.Id, plov, tea, shift.Id);
    }

    /// <summary>A fully paid order (one payment at <paramref name="paidAtUtc"/>); returns the order and its payment.</summary>
    public (Order Order, Payment Payment) PaidOrder(
        AppDbContext db, TestMenu menu, DateOnly businessDate, DateTime paidAtUtc, PaymentMethod method,
        params (MenuItem Item, decimal Quantity)[] lines)
    {
        var order = NewOrder(businessDate, paidAtUtc, lines);
        order.RegisterPayment(order.Total, org.User.Id, paidAtUtc);
        var payment = new Payment
        {
            OrganizationId = org.OrganizationId,
            BranchId = org.BranchId,
            OrderId = order.Id,
            CashShiftId = menu.ShiftId,
            Method = method,
            Amount = order.Total,
            IdempotencyKey = Guid.NewGuid().ToString(),
            CreatedAt = paidAtUtc,
        };
        db.AddRange(order, payment);
        return (order, payment);
    }

    /// <summary>An open (unpaid) order — must not count as revenue.</summary>
    public Order OpenOrder(AppDbContext db, DateOnly businessDate, DateTime openedAtUtc, params (MenuItem Item, decimal Quantity)[] lines)
    {
        var order = NewOrder(businessDate, openedAtUtc, lines);
        db.Add(order);
        return order;
    }

    public Refund Refund(AppDbContext db, TestMenu menu, Order order, Payment payment, decimal amount, DateTime atUtc)
    {
        order.RegisterRefund(amount);
        payment.RefundedAmount += amount;
        payment.Status = payment.RefundedAmount == payment.Amount ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;
        var refund = new Refund
        {
            OrganizationId = org.OrganizationId,
            BranchId = org.BranchId,
            PaymentId = payment.Id,
            CashShiftId = menu.ShiftId,
            Method = payment.Method,
            Amount = amount,
            Reason = "Жалоба гостя",
            CreatedAt = atUtc,
        };
        db.Add(refund);
        return refund;
    }

    private Order NewOrder(DateOnly businessDate, DateTime openedAtUtc, (MenuItem Item, decimal Quantity)[] lines)
    {
        var order = Order.Create(org.OrganizationId, org.BranchId, OrderType.Takeaway, null, org.User.Id, 1,
            ++_number, businessDate, null, openedAtUtc);
        foreach (var (item, quantity) in lines)
        {
            order.AddItem(OrderItem.Create(item.Id, item.Name, item.Price, quantity), OrderPricingSettings.None, org.User.Id, openedAtUtc);
        }

        return order;
    }
}
