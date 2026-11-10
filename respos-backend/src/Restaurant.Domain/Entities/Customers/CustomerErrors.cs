using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Customers;

public static class CustomerErrors
{
    public static readonly Error NotFound = Error.NotFound("customer.not_found", "Customer not found.");
    public static readonly Error InvalidPhone = Error.Validation("customer.invalid_phone", "Phone must be an Uzbekistan number (+998XXXXXXXXX).");
    public static readonly Error PhoneTaken = Error.Conflict("customer.phone_taken", "A customer with this phone already exists.");
    public static readonly Error NameRequired = Error.Validation("customer.name_required", "Customer name is required.");
    public static readonly Error InvalidTags = Error.Validation("customer.invalid_tags", "Too many tags or a tag is too long.");
    public static readonly Error HasHistory = Error.BusinessRule("customer.has_history", "The customer has orders or loyalty history and cannot be deleted.");
}

public static class LoyaltyErrors
{
    public static readonly Error InvalidSettings = Error.Validation("loyalty.invalid_settings", "Loyalty settings are invalid.");
    public static readonly Error Disabled = Error.BusinessRule("loyalty.disabled", "The loyalty program is disabled.");
    public static readonly Error NoCustomer = Error.BusinessRule("loyalty.no_customer", "Attach a customer to the order first.");
    public static readonly Error InsufficientPoints = Error.BusinessRule("loyalty.insufficient_points", "The customer does not have enough points.");
    public static readonly Error ExceedsLimit = Error.BusinessRule("loyalty.exceeds_limit", "Points exceed the maximum share of the bill payable by points.");
    public static readonly Error BelowMinOrder = Error.BusinessRule("loyalty.below_min_order", "The order is below the minimum amount for the loyalty program.");
    public static readonly Error InvalidPoints = Error.Validation("loyalty.invalid_points", "Points must be a positive whole number.");
    public static readonly Error AlreadyRedeemed = Error.Conflict("loyalty.already_redeemed", "Points are already redeemed on this order; cancel the redemption first.");
    public static readonly Error RedemptionActive = Error.Conflict("loyalty.redemption_active", "Cancel the points redemption before changing the order's customer.");
    public static readonly Error NothingRedeemed = Error.Conflict("loyalty.nothing_redeemed", "No points are redeemed on this order.");
}
