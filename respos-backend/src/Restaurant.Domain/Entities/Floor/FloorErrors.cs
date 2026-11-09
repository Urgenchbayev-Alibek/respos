using Restaurant.Domain.Common;

namespace Restaurant.Domain.Entities.Floor;

public static class FloorErrors
{
    public static readonly Error AreaNotFound = Error.NotFound("dining_area.not_found", "Dining area not found.");

    public static readonly Error AreaArchived =
        Error.Conflict("dining_area.archived", "The dining area is archived.");

    public static readonly Error AreaHasTables =
        Error.Conflict("dining_area.has_tables", "The dining area still has tables. Archive or move them first.");

    public static readonly Error TableNotFound = Error.NotFound("table.not_found", "Table not found.");

    public static readonly Error TableNumberTaken =
        Error.Conflict("table.number_taken", "A table with this number already exists in the branch.");

    public static readonly Error TableArchived = Error.Conflict("table.archived", "The table is archived.");

    public static readonly Error TableUnavailable =
        Error.Conflict("table.unavailable", "The table is marked as unavailable.");

    public static readonly Error TableHasActiveOrder =
        Error.Conflict("table.has_active_order", "The table has an active order.");

    public static readonly Error InvalidManualStatus =
        Error.Validation("table.invalid_status", "Only 'available' or 'unavailable' can be set manually.");
}
