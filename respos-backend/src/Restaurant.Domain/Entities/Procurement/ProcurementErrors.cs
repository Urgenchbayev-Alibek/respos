using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Procurement;

public static class ProcurementErrors
{
    public static readonly Error SupplierNotFound = Error.NotFound("supplier.not_found", "Supplier not found.");
    public static readonly Error SupplierArchived = Error.BusinessRule("supplier.archived", "The supplier is archived.");
    public static readonly Error PurchaseNotFound = Error.NotFound("purchase.not_found", "Purchase order not found.");
    public static readonly Error NotEditable = Error.Conflict("purchase.not_editable", "Only draft purchase orders can be edited.");
    public static readonly Error ItemNotFound = Error.BusinessRule("purchase.item_not_found", "Purchase order line not found.");

    public static readonly Error ReceiveExceedsRemaining =
        Error.BusinessRule("purchase.receive_exceeds_remaining", "Received quantity exceeds the remaining quantity of the line.");

    public static readonly Error InvalidReceiveQuantity =
        Error.Validation("purchase.invalid_receive_quantity", "Received quantity must be greater than zero.");

    public static Error InvalidTransition(PurchaseOrderStatus from, PurchaseOrderStatus to) =>
        Error.Conflict("purchase.invalid_status_transition", $"Cannot change purchase status from {from} to {to}.");
}
