using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Delivery;

public static class DeliveryErrors
{
    public static readonly Error NotFound = Error.NotFound("delivery.not_found", "Delivery order not found.");
    public static readonly Error Closed = Error.Conflict("delivery.closed", "The delivery is already delivered or cancelled.");
    public static readonly Error CourierRequired = Error.BusinessRule("delivery.courier_required", "Assign a courier before sending the order out.");
    public static readonly Error CancelReasonRequired = Error.Validation("delivery.cancel_reason_required", "Cancel reason is required.");
    public static readonly Error ItemsRequired = Error.Validation("delivery.items_required", "A delivery order needs at least one item.");
    public static readonly Error CourierNotFound = Error.NotFound("courier.not_found", "Courier not found.");
    public static readonly Error CourierInactive = Error.BusinessRule("courier.inactive", "The courier is inactive.");
    public static readonly Error SlugTaken = Error.Conflict("branch.slug_taken", "This public menu address is already used.");
    public static readonly Error MenuNotFound = Error.NotFound("public_menu.not_found", "Menu not found.");
    public static readonly Error WaiterCallNotFound = Error.NotFound("waiter_call.not_found", "Waiter call not found.");

    public static Error InvalidTransition(DeliveryStatus from, DeliveryStatus to) =>
        Error.Conflict("delivery.invalid_status_transition", $"Cannot change delivery status from {from} to {to}.");
}
