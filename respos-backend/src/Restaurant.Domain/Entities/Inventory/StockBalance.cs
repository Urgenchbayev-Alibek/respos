using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Inventory;

/// <summary>Per-branch ingredient balance. Changes ONLY through <see cref="Apply"/> together with a movement.</summary>
public class StockBalance : AuditableEntity, IBranchScoped
{
    public static readonly Error Insufficient =
        Error.Conflict("stock.insufficient", "Insufficient stock for this operation.");

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid IngredientId { get; set; }
    public decimal Quantity { get; private set; }
    public decimal MinQuantity { get; set; }

    /// <summary>Concurrency token mapped to Postgres <c>xmin</c>.</summary>
    public uint RowVersion { get; private set; }

    public Ingredient? Ingredient { get; set; }

    public bool IsLow => Quantity <= MinQuantity;

    public static StockBalance Create(Guid organizationId, Guid branchId, Guid ingredientId, decimal minQuantity = 0m) =>
        new()
        {
            OrganizationId = organizationId,
            BranchId = branchId,
            IngredientId = ingredientId,
            MinQuantity = minQuantity,
        };

    /// <summary>
    /// Applies a signed movement (base unit) and stamps <see cref="StockMovement.BalanceAfter"/>.
    /// Throws 409 <c>stock.insufficient</c> when the result would be negative and negatives are not allowed.
    /// </summary>
    public void Apply(StockMovement movement, bool allowNegative)
    {
        if (movement.IngredientId != IngredientId || movement.BranchId != BranchId)
        {
            throw new InvalidOperationException("Stock movement does not belong to this balance.");
        }

        var next = Quantity + movement.Quantity;
        if (next < 0 && movement.Quantity < 0 && !allowNegative)
        {
            throw new DomainException(Insufficient);
        }

        var wasLow = IsLow;
        Quantity = next;
        movement.BalanceAfter = next;
        if (!wasLow && IsLow)
        {
            Raise(new StockLowDomainEvent(IngredientId, BranchId, Quantity, MinQuantity));
        }
    }
}

public class StockMovement : Entity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid IngredientId { get; set; }
    public StockMovementType Type { get; set; }

    /// <summary>Signed quantity in the ingredient base unit (+ in, − out).</summary>
    public decimal Quantity { get; set; }

    public decimal BalanceAfter { get; set; }
    public decimal? UnitCost { get; set; }
    public StockMovementSource SourceType { get; set; }
    public Guid? SourceId { get; set; }
    public string? Reason { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }

    public Ingredient? Ingredient { get; set; }
}
