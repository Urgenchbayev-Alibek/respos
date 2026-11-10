using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Orders;

public static class OrderBillErrors
{
    public static readonly Error BillNotFound = Error.NotFound("order.bill_not_found", "Bill not found.");
    public static readonly Error AlreadySplit = Error.Conflict("order.already_split", "The order is already split; merge the bills first.");
    public static readonly Error NotSplit = Error.Conflict("order.not_split", "The order is not split into bills.");
    public static readonly Error SplitActive =
        Error.Conflict("order.split_active", "The order is split into bills; merge the bills before changing items or discounts.");
    public static readonly Error InvalidSplit = Error.BusinessRule("order.invalid_split", "The split is invalid (2–20 bills, every bill > 0).");
    public static readonly Error SplitMismatch = Error.BusinessRule("order.split_mismatch", "Bill amounts must sum exactly to the order total.");
    public static readonly Error BillRequired = Error.BusinessRule("payment.bill_required", "The order is split: choose the bill to pay.");
    public static readonly Error BillPaid = Error.Conflict("order.bill_paid", "The bill is already paid.");
}
