namespace Restaurant.Domain.Common;

public enum ErrorType
{
    Failure = 0,
    Validation = 1,
    Unauthorized = 2,
    Forbidden = 3,
    NotFound = 4,
    Conflict = 5,
    BusinessRule = 6,
    TooManyRequests = 7,
}

/// <summary>Stable, dot-separated error code (contract) + default message + category (maps to HTTP status).</summary>
public sealed record Error(string Code, string Message, ErrorType Type)
{
    public static readonly Error None = new(string.Empty, string.Empty, ErrorType.Failure);

    public IReadOnlyDictionary<string, string[]>? Details { get; init; }

    public static Error Validation(string code, string message) => new(code, message, ErrorType.Validation);
    public static Error NotFound(string code, string message) => new(code, message, ErrorType.NotFound);
    public static Error Conflict(string code, string message) => new(code, message, ErrorType.Conflict);
    public static Error Forbidden(string code, string message) => new(code, message, ErrorType.Forbidden);
    public static Error Unauthorized(string code, string message) => new(code, message, ErrorType.Unauthorized);
    public static Error BusinessRule(string code, string message) => new(code, message, ErrorType.BusinessRule);
    public static Error Failure(string code, string message) => new(code, message, ErrorType.Failure);
}
