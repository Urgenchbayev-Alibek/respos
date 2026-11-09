using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Payments;

/// <summary>MVP rule: one open shift per branch.</summary>
public partial class CashShift : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid OpenedBy { get; set; }
    public DateTime OpenedAt { get; set; }
    public decimal OpeningAmount { get; set; }
    public Guid? ClosedBy { get; set; }
    public DateTime? ClosedAt { get; set; }
    public decimal? ExpectedCashAmount { get; set; }
    public decimal? ActualCashAmount { get; set; }
    public decimal? Difference { get; set; }
    public CashShiftStatus Status { get; set; } = CashShiftStatus.Open;
    public string? Comment { get; set; }
}

public partial class Payment : AuditableEntity, IBranchScoped
{
    public const string ManualProvider = "manual";

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid OrderId { get; set; }
    public Guid CashShiftId { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal Amount { get; set; }
    public decimal RefundedAmount { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Completed;
    public string Provider { get; set; } = ManualProvider;
    public string? ExternalReference { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;

    public ICollection<Refund> Refunds { get; set; } = [];

    public decimal RefundableAmount => Amount - RefundedAmount;
}

public class Refund : AuditableEntity, IBranchScoped
{
    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid PaymentId { get; set; }
    public Guid CashShiftId { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
}
