using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Restaurant.Api.Errors;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Api.Middleware;

/// <summary>
/// Maps exceptions to ProblemDetails (never exposes stack traces):
/// DomainException → by error type; ValidationException → 400; DbUpdateConcurrencyException → 409
/// <c>concurrency.conflict</c>; unique violation → 409 <c>conflict.duplicate</c>; anything else → 500 <c>server.error</c>.
/// </summary>
public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex) when (!context.Response.HasStarted && ex is not OperationCanceledException)
        {
            await HandleAsync(context, ex);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            logger.LogInformation("Request {Path} was cancelled by the client", context.Request.Path);
        }
    }

    private Task HandleAsync(HttpContext context, Exception exception)
    {
        switch (exception)
        {
            case DomainException domain:
                logger.LogInformation("Domain rule violated: {Code}", domain.Error.Code);
                return ApiProblems.WriteAsync(context, ApiProblems.StatusFor(domain.Error.Type), domain.Error.Code, domain.Error.Message, domain.Error.Details);
            case ValidationException validation:
                var errors = validation.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
                return ApiProblems.WriteAsync(context, 400, "validation.failed", "One or more fields are invalid.", errors);
            case DbUpdateConcurrencyException:
                logger.LogWarning(exception, "Concurrency conflict");
                return ApiProblems.WriteAsync(context, 409, "concurrency.conflict", "The resource was modified by someone else. Reload and retry.");
            case DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg }:
                logger.LogWarning("Unique constraint violated: {Constraint}", pg.ConstraintName);
                return ApiProblems.WriteAsync(context, 409, "conflict.duplicate", "A record with the same unique value already exists.");
            case BadHttpRequestException bad:
                return ApiProblems.WriteAsync(context, bad.StatusCode, "request.invalid", "The request is invalid.");
            default:
                logger.LogError(exception, "Unhandled exception");
                return ApiProblems.WriteAsync(context, 500, "server.error", "An unexpected error occurred.");
        }
    }
}
