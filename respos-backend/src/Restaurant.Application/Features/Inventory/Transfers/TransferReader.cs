using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.Transfers;

/// <summary>
/// Read side of stock transfers. A branch sees its outgoing transfers (any status) and incoming ones once sent
/// (the destination never sees the source's drafts). Other branches/tenants → 404.
/// </summary>
[ScopedService]
public sealed class TransferReader(IApplicationDbContext db)
{
    public static Expression<Func<StockTransfer, bool>> VisibleTo(Guid branchId) =>
        t => t.FromBranchId == branchId || (t.ToBranchId == branchId && t.Status != StockTransferStatus.Draft);

    public IQueryable<StockTransfer> Visible(Guid branchId) => db.StockTransfers.AsNoTracking().Where(VisibleTo(branchId));

    public async Task<IReadOnlyList<StockTransferDto>> ToSummariesAsync(Guid branchId, IReadOnlyList<StockTransfer> transfers, CancellationToken ct)
    {
        var ids = transfers.Select(t => t.Id).ToList();
        var totals = await db.StockTransferLines.AsNoTracking()
            .Where(l => ids.Contains(l.StockTransferId))
            .GroupBy(l => l.StockTransferId)
            .Select(g => new { Id = g.Key, Count = g.Count(), Cost = g.Sum(l => l.BaseQuantity * (l.UnitCost ?? 0m)) })
            .ToDictionaryAsync(x => x.Id, ct);
        var names = await BranchNamesAsync(transfers, ct);
        return transfers.Select(t =>
        {
            totals.TryGetValue(t.Id, out var total);
            return ToDto(t, branchId, names, total?.Count ?? 0, Money.Round(total?.Cost ?? 0m), []);
        }).ToList();
    }

    public async Task<StockTransferDto?> GetAsync(Guid branchId, Guid id, CancellationToken ct)
    {
        var transfer = await Visible(branchId)
            .Include(t => t.Lines).ThenInclude(l => l.Ingredient!).ThenInclude(i => i.BaseUnit)
            .Include(t => t.Lines).ThenInclude(l => l.Unit)
            .AsSplitQuery()
            .FirstOrDefaultAsync(t => t.Id == id, ct);
        if (transfer is null)
        {
            return null;
        }

        var names = await BranchNamesAsync([transfer], ct);
        var lines = transfer.Lines
            .OrderBy(l => l.Ingredient?.Name)
            .Select(l => new StockTransferLineDto(
                l.Id, l.IngredientId, l.Ingredient?.Name ?? string.Empty, l.Quantity, l.UnitId, l.Unit?.Code ?? string.Empty,
                l.BaseQuantity, l.Ingredient?.BaseUnit?.Code ?? string.Empty, l.UnitCost))
            .ToList();
        return ToDto(transfer, branchId, names, lines.Count, transfer.TotalCost, lines);
    }

    private async Task<Dictionary<Guid, string>> BranchNamesAsync(IReadOnlyList<StockTransfer> transfers, CancellationToken ct)
    {
        var ids = transfers.SelectMany(t => new[] { t.FromBranchId, t.ToBranchId }).Distinct().ToList();
        return await db.Branches.AsNoTracking().Where(b => ids.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name, ct);
    }

    private static StockTransferDto ToDto(
        StockTransfer t, Guid branchId, IReadOnlyDictionary<Guid, string> names, int lineCount, decimal totalCost,
        IReadOnlyList<StockTransferLineDto> lines) =>
        new(
            t.Id,
            t.Number,
            t.FromBranchId,
            names.GetValueOrDefault(t.FromBranchId, string.Empty),
            t.ToBranchId,
            names.GetValueOrDefault(t.ToBranchId, string.Empty),
            t.Status,
            t.FromBranchId == branchId ? StockTransferDirection.Outgoing : StockTransferDirection.Incoming,
            t.Comment,
            totalCost,
            lineCount,
            t.CreatedAt,
            t.SentAt,
            t.ReceivedAt,
            t.CancelledAt,
            lines);
}
