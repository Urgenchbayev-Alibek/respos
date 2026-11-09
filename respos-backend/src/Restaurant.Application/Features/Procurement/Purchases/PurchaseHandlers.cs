using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Procurement.Purchases;

/// <summary>
/// <c>GET /purchases</c>: list rows carry <c>items: []</c> on purpose (summary list; lines via <c>GET /purchases/{id}</c>).
/// Sort <c>createdAt|number|expectedAt|total</c> (default number desc).
/// </summary>
public sealed class ListPurchasesHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListPurchasesQuery, PagedResult<PurchaseDto>>
{
    private static readonly Dictionary<string, Expression<Func<PurchaseOrder, object>>> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["createdAt"] = p => p.CreatedAt,
        ["number"] = p => p.Number,
        ["expectedAt"] = p => p.ExpectedAt!,
        ["total"] = p => p.Total,
    };

    public async Task<Result<PagedResult<PurchaseDto>>> HandleAsync(ListPurchasesQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var query = db.PurchaseOrders.AsNoTracking().Where(p => p.BranchId == branchId);
        if (SnakeCaseEnum.TryParse<PurchaseOrderStatus>(request.Status, out var status))
        {
            query = query.Where(p => p.Status == status);
        }

        if (request.SupplierId is { } supplierId)
        {
            query = query.Where(p => p.SupplierId == supplierId);
        }

        if (request.From is { } from)
        {
            var fromUtc = from.ToUniversalTime();
            query = query.Where(p => p.CreatedAt >= fromUtc);
        }

        if (request.To is { } to)
        {
            var toUtc = to.ToUniversalTime();
            query = query.Where(p => p.CreatedAt <= toUtc);
        }

        return await query.ApplySort(request, SortFields, p => p.Number, defaultDescending: true)
            .Select(p => new PurchaseDto(p.Id, p.Number, p.SupplierId, p.Supplier!.Name, p.Status, p.ExpectedAt, p.Total, p.Comment,
                p.CreatedAt, new List<PurchaseItemDto>()))
            .ToPagedResultAsync(request, cancellationToken);
    }
}

public sealed class GetPurchaseHandler(ITenantContext tenant, PurchaseReader reader) : IHandler<GetPurchaseQuery, PurchaseDto>
{
    public async Task<Result<PurchaseDto>> HandleAsync(GetPurchaseQuery request, CancellationToken cancellationToken) =>
        await reader.GetAsync(tenant.RequireBranchId(), request.Id, cancellationToken) is { } dto ? dto : ProcurementErrors.PurchaseNotFound;
}

/// <summary>Creates a draft or replaces a draft's header and items (non-draft → 409 <c>purchase.not_editable</c>).</summary>
public sealed class SavePurchaseHandler(
    IApplicationDbContext db, ITenantContext tenant, UnitConverter converter, PurchaseReader reader, IAuditLogger audit)
    : IHandler<SavePurchaseCommand, PurchaseDto>
{
    public async Task<Result<PurchaseDto>> HandleAsync(SavePurchaseCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var branchId = tenant.RequireBranchId();
        var check = await ValidateAsync(orgId, request, cancellationToken);
        if (check.IsFailure)
        {
            return check.Error;
        }

        PurchaseOrder? po;
        if (request.Id is { } id)
        {
            po = await db.PurchaseOrders.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == id && p.BranchId == branchId, cancellationToken);
            if (po is null)
            {
                return ProcurementErrors.PurchaseNotFound;
            }

            po.EnsureEditable();
        }
        else
        {
            var last = await db.PurchaseOrders.Where(p => p.BranchId == branchId).MaxAsync(p => (int?)p.Number, cancellationToken) ?? 0;
            po = new PurchaseOrder { OrganizationId = orgId, BranchId = branchId, Number = last + 1 };
            db.PurchaseOrders.Add(po);
        }

        po.SupplierId = request.SupplierId;
        po.ExpectedAt = request.ExpectedAt?.ToUniversalTime();
        po.Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        var items = request.Items
            .Select(l => new PurchaseOrderItem { IngredientId = l.IngredientId, Quantity = l.Quantity, UnitId = l.UnitId, UnitPrice = l.UnitPrice })
            .ToList();
        po.ReplaceItems(items);
        db.PurchaseOrderItems.AddRange(items); // explicit Add: client-generated keys on a tracked parent
        audit.Log(request.Id is null ? "purchase.created" : "purchase.updated", nameof(PurchaseOrder), po.Id,
            new { po.Number, po.SupplierId, po.Total, items = items.Count });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, po.Id, cancellationToken))!;
    }

    private async Task<Result> ValidateAsync(Guid orgId, SavePurchaseCommand request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == request.SupplierId, cancellationToken);
        if (supplier is null)
        {
            return ProcurementErrors.SupplierNotFound;
        }

        if (supplier.IsArchived)
        {
            return ProcurementErrors.SupplierArchived;
        }

        var ids = request.Items.Select(i => i.IngredientId).Distinct().ToList();
        var ingredients = await db.Ingredients.AsNoTracking().Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id, cancellationToken);
        var unitIds = request.Items.Select(l => l.UnitId).Distinct().ToList();
        if (await db.Units.CountAsync(u => unitIds.Contains(u.Id), cancellationToken) != unitIds.Count)
        {
            return InventoryErrors.UnitNotFound;
        }

        foreach (var line in request.Items)
        {
            if (!ingredients.TryGetValue(line.IngredientId, out var ingredient))
            {
                return InventoryErrors.IngredientNotFound;
            }

            if (ingredient.IsArchived)
            {
                return InventoryErrors.IngredientArchived;
            }

            if (await converter.TryGetFactorAsync(orgId, line.UnitId, ingredient.BaseUnitId, cancellationToken) is null)
            {
                return InventoryErrors.ConversionMissing;
            }
        }

        return Result.Success();
    }
}

public sealed class SubmitPurchaseHandler(IApplicationDbContext db, ITenantContext tenant, PurchaseReader reader, IAuditLogger audit)
    : IHandler<PurchaseActionCommand, PurchaseDto>
{
    public Task<Result<PurchaseDto>> HandleAsync(PurchaseActionCommand request, CancellationToken cancellationToken) =>
        PurchaseTransitions.RunAsync(db, tenant, reader, audit, request.Id, "purchase.submitted", po => po.Submit(), cancellationToken);
}

public sealed class CancelPurchaseHandler(IApplicationDbContext db, ITenantContext tenant, PurchaseReader reader, IAuditLogger audit)
    : IHandler<PurchaseActionCommand, PurchaseDto>
{
    public Task<Result<PurchaseDto>> HandleAsync(PurchaseActionCommand request, CancellationToken cancellationToken) =>
        PurchaseTransitions.RunAsync(db, tenant, reader, audit, request.Id, "purchase.cancelled", po => po.Cancel(), cancellationToken);
}

internal static class PurchaseTransitions
{
    public static async Task<Result<PurchaseDto>> RunAsync(
        IApplicationDbContext db, ITenantContext tenant, PurchaseReader reader, IAuditLogger audit,
        Guid id, string action, Action<PurchaseOrder> transition, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var po = await db.PurchaseOrders.FirstOrDefaultAsync(p => p.Id == id && p.BranchId == branchId, cancellationToken);
        if (po is null)
        {
            return ProcurementErrors.PurchaseNotFound;
        }

        var from = po.Status;
        transition(po); // invalid transition → DomainException → 409
        audit.Log(action, nameof(PurchaseOrder), po.Id, new { from, to = po.Status });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(branchId, po.Id, cancellationToken))!;
    }
}
