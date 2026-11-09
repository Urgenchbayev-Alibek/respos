using Restaurant.Domain.Common;

namespace Restaurant.Application.Common.Errors;

public static class TenantErrors
{
    public static readonly Error Required =
        Error.Forbidden("tenant.required", "An organization context is required.");

    public static readonly Error BranchForbidden =
        Error.Forbidden("tenant.branch_forbidden", "Branch is missing or not accessible.");

    public static readonly Error Unauthenticated =
        Error.Unauthorized("auth.unauthenticated", "Authentication is required.");
}

public static class PlanErrors
{
    public static Error LimitExceeded(string resource) =>
        Error.BusinessRule("plan.limit_exceeded", $"The subscription plan limit for {resource} is reached.");
}

public static class CommonErrors
{
    public static Error NotFound(string entity) =>
        Error.NotFound($"{entity}.not_found", $"{entity} not found.");
}
