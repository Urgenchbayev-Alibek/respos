using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.CreateOrder;

/// <summary>
/// <c>POST /orders</c>: draft order with optional items; dine-in table → <c>occupied</c>. Number is sequential per
/// branch per business date (branch timezone); the unique index (branch, date, number) + retry make it concurrency-safe.
/// </summary>
public sealed class CreateOrderHandler(
    IApplicationDbContext db,
    ITenantContext tenant,
    IClock clock,
    OrderWriter writer,
    OrderItemFactory itemFactory,
    TableOccupancy tables)
    : IHandler<CreateOrderCommand, OrderDto>
{
    private const int MaxNumberAttempts = 5;
    private const string UniqueViolation = "23505";

    public async Task<Result<OrderDto>> HandleAsync(CreateOrderCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var userId = tenant.RequireUserId();
        var now = clock.UtcNow;
        var localNow = await writer.BranchLocalNowAsync(cancellationToken);

        Domain.Entities.Floor.DiningTable? table = null;
        if (request.Type == OrderType.DineIn)
        {
            var found = await tables.GetUsableTableAsync(request.TableId!.Value, cancellationToken);
            if (found.IsFailure)
            {
                return found.Error;
            }

            table = found.Value;
        }

        var items = await itemFactory.BuildAsync(request.Items ?? [], localNow, cancellationToken);
        if (items.IsFailure)
        {
            return items.Error;
        }

        var businessDate = DateOnly.FromDateTime(localNow);
        var order = Order.Create(
            tenant.RequireOrganizationId(), branchId, request.Type, table?.Id, userId, request.GuestCount,
            await writer.NextNumberAsync(businessDate, cancellationToken), businessDate,
            string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(), now);
        var pricing = await writer.PricingAsync(cancellationToken);
        foreach (var item in items.Value)
        {
            order.AddItem(item, pricing, userId, now);
        }

        db.Orders.Add(order);
        if (table is not null)
        {
            tables.Occupy(table);
        }

        writer.NotifyOrderUpdated(order);
        await SaveWithUniqueNumberAsync(order, businessDate, cancellationToken);
        return await writer.ReadAsync(order.Id, cancellationToken);
    }

    private async Task SaveWithUniqueNumberAsync(Order order, DateOnly businessDate, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await db.SaveChangesAsync(ct);
                return;
            }
            catch (DbUpdateException ex) when (attempt < MaxNumberAttempts && ex.InnerException is DbException { SqlState: UniqueViolation })
            {
                order.Renumber(await writer.NextNumberAsync(businessDate, ct));
            }
        }
    }
}
