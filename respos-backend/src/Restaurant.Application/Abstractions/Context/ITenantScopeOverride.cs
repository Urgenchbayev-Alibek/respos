namespace Restaurant.Application.Abstractions.Context;

/// <summary>
/// Enters the tenant scope of a record found by a trusted, verified server-side lookup (e.g. a provider callback
/// that passed signature/auth checks). Only allowed while the request has no tenant; never from client input.
/// </summary>
public interface ITenantScopeOverride
{
    void Enter(Guid organizationId, Guid branchId);
}
