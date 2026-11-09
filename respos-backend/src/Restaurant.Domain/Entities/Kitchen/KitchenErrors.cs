using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Kitchen;

public static class KitchenErrors
{
    public static readonly Error TicketNotFound = Error.NotFound("kitchen_ticket.not_found", "Kitchen ticket not found.");
    public static readonly Error TicketItemNotFound = Error.NotFound("kitchen_ticket_item.not_found", "Kitchen ticket item not found.");
    public static readonly Error NoActiveStation =
        Error.BusinessRule("kitchen_station.not_configured", "The branch has no active kitchen station.");

    public static Error InvalidTransition(KitchenTicketStatus from, KitchenTicketStatus to) =>
        Error.Conflict("kitchen_ticket.invalid_status_transition", $"Cannot change ticket status from {from} to {to}.");

    public static Error InvalidItemTransition(KitchenTicketItemStatus from, KitchenTicketItemStatus to) =>
        Error.Conflict("kitchen_ticket.invalid_status_transition", $"Cannot change ticket item status from {from} to {to}.");
}
