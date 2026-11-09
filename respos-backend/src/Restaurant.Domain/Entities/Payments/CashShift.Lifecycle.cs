using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Payments;

/// <summary>Open/close rules. Expected cash = opening + Σ cash payments − Σ cash refunds of this shift.</summary>
public partial class CashShift
{
    public static CashShift Open(Guid branchId, Guid openedBy, decimal openingAmount, DateTime utcNow)
    {
        if (openingAmount < 0)
        {
            throw new DomainException(CashShiftErrors.InvalidAmount);
        }

        return new CashShift
        {
            BranchId = branchId,
            OpenedBy = openedBy,
            OpenedAt = utcNow,
            OpeningAmount = Money.Round(openingAmount),
            Status = CashShiftStatus.Open,
        };
    }

    public static decimal CalculateExpectedCash(decimal openingAmount, decimal cashPayments, decimal cashRefunds) =>
        Money.Round(openingAmount + cashPayments - cashRefunds);

    public void Close(decimal expectedCashAmount, decimal actualCashAmount, Guid closedBy, string? comment, DateTime utcNow)
    {
        if (Status != CashShiftStatus.Open)
        {
            throw new DomainException(CashShiftErrors.Closed);
        }

        if (actualCashAmount < 0)
        {
            throw new DomainException(CashShiftErrors.InvalidAmount);
        }

        ExpectedCashAmount = Money.Round(expectedCashAmount);
        ActualCashAmount = Money.Round(actualCashAmount);
        Difference = ActualCashAmount - ExpectedCashAmount;
        ClosedBy = closedBy;
        ClosedAt = utcNow;
        Comment = comment;
        Status = CashShiftStatus.Closed;
    }
}
