using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Inventory;

/// <summary>Inventarization rules: only a draft can be edited or completed; a completed count is immutable.</summary>
public partial class InventoryCount
{
    public void EnsureDraft()
    {
        if (Status != InventoryCountStatus.Draft)
        {
            throw new DomainException(InventoryErrors.CountCompleted);
        }
    }

    public InventoryCountLine AddLine(Guid ingredientId, decimal expectedQty)
    {
        EnsureDraft();
        var line = new InventoryCountLine { InventoryCountId = Id, IngredientId = ingredientId, ExpectedQty = expectedQty };
        Lines.Add(line);
        return line;
    }

    public void SetCounted(Guid ingredientId, decimal? countedQty)
    {
        EnsureDraft();
        var line = Lines.FirstOrDefault(l => l.IngredientId == ingredientId)
            ?? throw new DomainException(InventoryErrors.IngredientNotFound);
        line.CountedQty = countedQty;
    }

    /// <summary>Lines whose counted quantity differs from the snapshot: (ingredient, counted − expected).</summary>
    public IReadOnlyList<(Guid IngredientId, decimal Difference)> Differences() =>
        Lines.Where(l => l.CountedQty is { } counted && counted != l.ExpectedQty)
            .Select(l => (l.IngredientId, l.CountedQty!.Value - l.ExpectedQty))
            .ToList();

    public void Complete(DateTime utcNow)
    {
        EnsureDraft();
        Status = InventoryCountStatus.Completed;
        CompletedAt = utcNow;
    }
}
