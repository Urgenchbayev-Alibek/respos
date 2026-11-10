using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Domain.Events;
using static System.FormattableString;

namespace Restaurant.Application.Features.Integrations.Alerts;

/// <summary><see cref="StockLowDomainEvent"/> → Telegram <c>low_stock</c> (raised only when the balance crosses the minimum).</summary>
public sealed class StockLowTelegramHandler(IApplicationDbContext db, OwnerAlerts alerts) : IDomainEventHandler<StockLowDomainEvent>
{
    public async Task HandleAsync(StockLowDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var ingredient = db.Ingredients.Local.FirstOrDefault(i => i.Id == domainEvent.IngredientId)
                         ?? await db.Ingredients.IgnoreQueryFilters().AsNoTracking()
                             .FirstOrDefaultAsync(i => i.Id == domainEvent.IngredientId, cancellationToken);
        if (ingredient is null || await alerts.ContextAsync(ingredient.OrganizationId, domainEvent.BranchId, cancellationToken) is not { } ctx)
        {
            return;
        }

        var text = $"⚠️ Низкий остаток: {ingredient.Name}\nФилиал: {ctx.BranchName}\n"
                   + $"Остаток {AlertFormat.Quantity(domainEvent.Quantity)} при минимуме {AlertFormat.Quantity(domainEvent.MinQuantity)}";
        await alerts.TelegramAsync(ctx.OrganizationId, ctx.BranchId, AlertKinds.LowStock, c => c.LowStockEnabled,
            $"Низкий остаток: {ingredient.Name}", text, cancellationToken);
    }
}

/// <summary><see cref="PaymentRefundedDomainEvent"/> → Telegram <c>big_refund</c> when amount ≥ the configured threshold.</summary>
public sealed class BigRefundTelegramHandler(OwnerAlerts alerts) : IDomainEventHandler<PaymentRefundedDomainEvent>
{
    public async Task HandleAsync(PaymentRefundedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        if (await alerts.ContextAsync(domainEvent.OrganizationId, domainEvent.BranchId, cancellationToken) is not { } ctx)
        {
            return;
        }

        var amount = AlertFormat.Money(domainEvent.Amount, ctx.Currency);
        var text = $"💸 Крупный возврат: {amount}\nФилиал: {ctx.BranchName}\nПричина: {domainEvent.Reason}";
        await alerts.TelegramAsync(ctx.OrganizationId, ctx.BranchId, AlertKinds.BigRefund,
            c => c.BigRefundEnabled && domainEvent.Amount >= c.BigRefundThreshold,
            $"Крупный возврат: {amount}", text, cancellationToken);
    }
}

/// <summary><see cref="CashShiftClosedDomainEvent"/> → Telegram <c>shift_difference</c> when actual ≠ expected cash.</summary>
public sealed class ShiftDifferenceTelegramHandler(OwnerAlerts alerts) : IDomainEventHandler<CashShiftClosedDomainEvent>
{
    public async Task HandleAsync(CashShiftClosedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        if (domainEvent.Difference == 0
            || await alerts.ContextAsync(domainEvent.OrganizationId, domainEvent.BranchId, cancellationToken) is not { } ctx)
        {
            return;
        }

        var sign = domainEvent.Difference > 0 ? "излишек" : "недостача";
        var difference = AlertFormat.Money(Math.Abs(domainEvent.Difference), ctx.Currency);
        var text = $"🧾 Смена закрыта с расхождением ({sign}): {difference}\nФилиал: {ctx.BranchName}\n"
                   + $"Ожидалось: {AlertFormat.Money(domainEvent.Expected, ctx.Currency)}, факт: {AlertFormat.Money(domainEvent.Actual, ctx.Currency)}";
        await alerts.TelegramAsync(ctx.OrganizationId, ctx.BranchId, AlertKinds.ShiftDifference, c => c.ShiftDifferenceEnabled,
            $"Расхождение в кассе: {difference}", text, cancellationToken);
    }
}

/// <summary><see cref="ReservationConfirmedDomainEvent"/> → guest SMS <c>reservation_confirmed</c> (Eskiz enabled + option on).</summary>
public sealed class ReservationConfirmedSmsHandler(IApplicationDbContext db, OwnerAlerts alerts)
    : IDomainEventHandler<ReservationConfirmedDomainEvent>
{
    public async Task HandleAsync(ReservationConfirmedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var reservation = db.TableReservations.Local.FirstOrDefault(r => r.Id == domainEvent.ReservationId)
                          ?? await db.TableReservations.IgnoreQueryFilters().AsNoTracking()
                              .FirstOrDefaultAsync(r => r.Id == domainEvent.ReservationId, cancellationToken);
        if (reservation is null
            || await alerts.ContextAsync(domainEvent.OrganizationId, domainEvent.BranchId, cancellationToken) is not { } ctx)
        {
            return;
        }

        var when = AlertFormat.LocalTime(reservation.StartsAt, ctx.TimeZone);
        var text = Invariant($"{ctx.BranchName}: бронь подтверждена на {when}, гостей: {reservation.GuestCount}. Ждём вас!");
        await alerts.SmsAsync(ctx.OrganizationId, ctx.BranchId, AlertKinds.ReservationConfirmed, reservation.GuestPhone,
            Invariant($"Бронь подтверждена: {when}"), text, cancellationToken);
    }
}

public static class AlertKinds
{
    public const string DailySummary = "daily_summary";
    public const string LowStock = "low_stock";
    public const string BigRefund = "big_refund";
    public const string ShiftDifference = "shift_difference";
    public const string OnlineReservation = "online_reservation";
    public const string ReservationConfirmed = "reservation_confirmed";
    public const string Email = "email";
    public const string Test = "test";
}
