using Restaurant.Domain.Common;

namespace Restaurant.Application.Common.Handlers;

/// <summary>
/// One use case = one handler class (command or query). Registered automatically by assembly scanning
/// (both as itself and as this interface). Controllers inject the concrete handler via [FromServices].
/// Request validation runs before the action via FluentValidation validators (IValidator&lt;TRequest&gt;).
/// </summary>
public interface IHandler<in TRequest, TResponse>
{
    Task<Result<TResponse>> HandleAsync(TRequest request, CancellationToken cancellationToken);
}
