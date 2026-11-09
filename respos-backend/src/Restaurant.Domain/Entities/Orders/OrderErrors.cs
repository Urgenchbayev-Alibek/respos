using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Orders;

public static class OrderErrors
{
    public static readonly Error NotFound = Error.NotFound("order.not_found", "Order not found.");
    public static readonly Error ItemNotFound = Error.NotFound("order.item_not_found", "Order item not found.");
    public static readonly Error HasPayments = Error.Conflict("order.has_payments", "The order has payments; refund them before cancelling.");
    public static readonly Error TableRequired = Error.Validation("order.table_required", "Dine-in orders require a table.");
    public static readonly Error OrderClosed = Error.Conflict("order.closed", "The order is already paid or cancelled.");
    public static readonly Error NothingToSend = Error.BusinessRule("order.nothing_to_send", "There are no new items to send.");
    public static readonly Error CancelReasonRequired = Error.Validation("order.cancel_reason_required", "Cancel reason is required.");
    public static readonly Error InvalidQuantity = Error.Validation("order.invalid_quantity", "Quantity must be greater than zero.");
    public static readonly Error ItemNotEditable = Error.Conflict("order.item_not_editable", "Only new items can be edited.");
    public static readonly Error InvalidDiscount = Error.Validation("order.invalid_discount", "Discount value is invalid.");
    public static readonly Error InvalidPaymentAmount = Error.Validation("payment.invalid_amount", "Payment amount must be greater than zero.");
    public static readonly Error PaymentExceedsDue = Error.BusinessRule("payment.exceeds_due", "Payment amount exceeds the remaining amount due.");
    public static readonly Error InvalidRefundAmount = Error.BusinessRule("payment.invalid_refund_amount", "Refund amount is invalid.");

    public static Error InvalidTransition(OrderStatus from, OrderStatus to) =>
        Error.Conflict("order.invalid_status_transition", $"Cannot change order status from {from} to {to}.");

    public static Error NotPayable(OrderStatus status) =>
        Error.Conflict("order.invalid_status_transition", $"Order in status {status} cannot be paid.");

    public static Error InvalidItemTransition(OrderItemStatus from, OrderItemStatus to) =>
        Error.Conflict("order.invalid_status_transition", $"Cannot change item status from {from} to {to}.");
}
