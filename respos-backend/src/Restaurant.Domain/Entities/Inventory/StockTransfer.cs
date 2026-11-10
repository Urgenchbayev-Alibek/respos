using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Inventory;

/// <summary>
/// Stock transfer between two branches of one organization. Flow: draft → sent → received; draft|sent → cancelled.
/// Only drafts are editable. Stock moves through the ledger: <c>transfer_out</c> at the source on send,
/// <c>transfer_in</c> at the destination on receive (or back at the source when a sent transfer is cancelled).
/// </summary>
public class StockTransfer : AuditableEntity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public int Number { get; set; }
    public Guid FromBranchId { get; set; }
    public Guid ToBranchId { get; set; }
    public StockTransferStatus Status { get; private set; } = StockTransferStatus.Draft;
    public string? Comment { get; set; }
    public DateTime? SentAt { get; private set; }
    public Guid? SentBy { get; private set; }
    public DateTime? ReceivedAt { get; private set; }
    public Guid? ReceivedBy { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public Guid? CancelledBy { get; private set; }

    /// <summary>Concurrency token mapped to Postgres <c>xmin</c> (send / receive / cancel race).</summary>
    public uint RowVersion { get; private set; }

    public ICollection<StockTransferLine> Lines { get; set; } = [];

    public decimal TotalCost => Money.Round(Lines.Sum(l => l.BaseQuantity * (l.UnitCost ?? 0m)));

    public void ReplaceLines(IEnumerable<StockTransferLine> lines)
    {
        EnsureDraft();
        Lines.Clear();
        foreach (var line in lines)
        {
            line.StockTransferId = Id;
            Lines.Add(line);
        }
    }

    public void EnsureDraft()
    {
        if (Status != StockTransferStatus.Draft)
        {
            throw new DomainException(StockTransferErrors.NotEditable);
        }
    }

    public void MarkSent(Guid userId, DateTime utcNow)
    {
        TransitionTo(StockTransferStatus.Sent, StockTransferStatus.Draft);
        if (Lines.Count == 0)
        {
            throw new DomainException(StockTransferErrors.Empty);
        }

        SentAt = utcNow;
        SentBy = userId;
    }

    public void MarkReceived(Guid userId, DateTime utcNow)
    {
        TransitionTo(StockTransferStatus.Received, StockTransferStatus.Sent);
        ReceivedAt = utcNow;
        ReceivedBy = userId;
    }

    /// <summary>Returns the status before cancellation (sent ⇒ the caller must return the stock to the source).</summary>
    public StockTransferStatus Cancel(Guid userId, DateTime utcNow)
    {
        var previous = Status;
        TransitionTo(StockTransferStatus.Cancelled, StockTransferStatus.Draft, StockTransferStatus.Sent);
        CancelledAt = utcNow;
        CancelledBy = userId;
        return previous;
    }

    private void TransitionTo(StockTransferStatus target, params StockTransferStatus[] allowedFrom)
    {
        if (!allowedFrom.Contains(Status))
        {
            throw new DomainException(StockTransferErrors.InvalidTransition(Status, target));
        }

        Status = target;
    }
}

/// <summary>Line in the entered unit; <see cref="BaseQuantity"/> and <see cref="UnitCost"/> (per base unit) are fixed on send.</summary>
public class StockTransferLine : Entity
{
    public Guid StockTransferId { get; set; }
    public Guid IngredientId { get; set; }
    public decimal Quantity { get; set; }
    public Guid UnitId { get; set; }
    public decimal BaseQuantity { get; set; }
    public decimal? UnitCost { get; set; }

    public Ingredient? Ingredient { get; set; }
    public UnitOfMeasure? Unit { get; set; }
}

public static class StockTransferErrors
{
    public static readonly Error NotFound = Error.NotFound("stock_transfer.not_found", "Stock transfer not found.");

    public static readonly Error NotEditable = Error.Conflict("stock_transfer.not_editable", "Only draft transfers can be edited.");

    public static readonly Error Empty = Error.BusinessRule("stock_transfer.empty", "The transfer has no lines.");

    public static readonly Error SameBranch =
        Error.BusinessRule("stock_transfer.same_branch", "Source and destination branches must differ.");

    public static readonly Error DestinationNotFound =
        Error.NotFound("stock_transfer.destination_not_found", "Destination branch not found or inactive.");

    public static readonly Error SourceOnly =
        Error.Forbidden("stock_transfer.source_branch_required", "This action must be performed from the source branch.");

    public static readonly Error DestinationOnly =
        Error.Forbidden("stock_transfer.destination_branch_required", "This action must be performed from the destination branch.");

    public static Error InvalidTransition(StockTransferStatus from, StockTransferStatus to) =>
        Error.Conflict("stock_transfer.invalid_status_transition", $"Cannot change transfer status from {from} to {to}.");
}
