using Microsoft.AspNetCore.SignalR;
using Serilog.Events;

namespace Restaurant.Api.Hubs;

/// <summary>
/// Refused hub calls (<see cref="HubException"/> with a safe code, e.g. <c>tenant.branch_forbidden</c>) are client errors:
/// this filter logs them at Warning without a stack trace. SignalR's own dispatcher logs EVERY failed invocation at Error
/// with the exception, so <see cref="IsExpectedHubError"/> drops exactly those duplicates from Serilog. Any other
/// exception type still reaches the log at Error.
/// </summary>
public sealed class HubErrorLoggingFilter(ILogger<HubErrorLoggingFilter> logger) : IHubFilter
{
    private const string DispatcherCategory = "Microsoft.AspNetCore.SignalR.Internal.DefaultHubDispatcher";

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext, Func<HubInvocationContext, ValueTask<object?>> next)
    {
        try
        {
            return await next(invocationContext);
        }
        catch (HubException ex)
        {
            logger.LogWarning("Hub method {HubMethod} refused: {Reason}", invocationContext.HubMethodName, ex.Message);
            throw;
        }
    }

    /// <summary>Serilog exclusion predicate: the dispatcher's Error entry for an expected <see cref="HubException"/>.</summary>
    public static bool IsExpectedHubError(LogEvent logEvent) =>
        logEvent.Exception is HubException
        && logEvent.Properties.TryGetValue("SourceContext", out var source)
        && source is ScalarValue { Value: DispatcherCategory };
}
