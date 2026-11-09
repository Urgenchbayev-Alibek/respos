using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.UnitTests.Payments;

public sealed class CashShiftAndRefundTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Expected_cash_is_opening_plus_cash_payments_minus_cash_refunds()
    {
        CashShift.CalculateExpectedCash(100000m, 250000.50m, 30000.25m).Should().Be(320000.25m);
    }

    [Fact]
    public void Closing_records_expected_actual_and_difference_once()
    {
        var shift = CashShift.Open(Guid.NewGuid(), Guid.NewGuid(), 100000m, Now);

        shift.Close(expectedCashAmount: 320000m, actualCashAmount: 319500m, Guid.NewGuid(), "недостача", Now);

        shift.Status.Should().Be(CashShiftStatus.Closed);
        shift.Difference.Should().Be(-500m);
        shift.Invoking(s => s.Close(1m, 1m, Guid.NewGuid(), null, Now)).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("cash_shift.closed");
    }

    [Fact]
    public void Negative_opening_amount_is_rejected()
    {
        var act = () => CashShift.Open(Guid.NewGuid(), Guid.NewGuid(), -1m, Now);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Refunds_are_limited_to_the_refundable_amount_and_update_payment_status()
    {
        var payment = new Payment { Amount = 50000m, Method = PaymentMethod.Card, IdempotencyKey = "k" };
        var shiftId = Guid.NewGuid();

        var refund = payment.AddRefund(20000m, "блюдо остыло", shiftId);

        refund.Method.Should().Be(PaymentMethod.Card);
        refund.CashShiftId.Should().Be(shiftId);
        payment.Status.Should().Be(PaymentStatus.PartiallyRefunded);
        payment.Invoking(p => p.AddRefund(30000.01m, "ещё", shiftId)).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("payment.invalid_refund_amount");
        payment.Invoking(p => p.AddRefund(1m, " ", shiftId)).Should().Throw<DomainException>();

        payment.AddRefund(30000m, "полный возврат", shiftId);
        payment.Status.Should().Be(PaymentStatus.Refunded);
        payment.RefundableAmount.Should().Be(0m);
    }
}
