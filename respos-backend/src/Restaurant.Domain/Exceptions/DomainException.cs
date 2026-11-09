using Restaurant.Domain.Common;

namespace Restaurant.Domain.Exceptions;

/// <summary>Thrown when a domain invariant is violated. Mapped to HTTP status by <see cref="Common.Error.Type"/>.</summary>
public sealed class DomainException(Error error) : Exception(error.Message)
{
    public Error Error { get; } = error;
}
