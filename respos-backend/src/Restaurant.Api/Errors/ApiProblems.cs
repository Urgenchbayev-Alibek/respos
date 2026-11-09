using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Middleware;
using Restaurant.Domain.Common;

namespace Restaurant.Api.Errors;

/// <summary>Builds contract ProblemDetails (<c>type,title,status,code,detail,correlationId,errors</c>).</summary>
public static class ApiProblems
{
    private const string TypeBase = "https://respos.dev/errors/";

    public static int StatusFor(ErrorType type) => type switch
    {
        ErrorType.Validation => StatusCodes.Status400BadRequest,
        ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
        ErrorType.Forbidden => StatusCodes.Status403Forbidden,
        ErrorType.NotFound => StatusCodes.Status404NotFound,
        ErrorType.Conflict => StatusCodes.Status409Conflict,
        ErrorType.BusinessRule => StatusCodes.Status422UnprocessableEntity,
        ErrorType.TooManyRequests => StatusCodes.Status429TooManyRequests,
        _ => StatusCodes.Status500InternalServerError,
    };

    public static ProblemDetails FromError(HttpContext context, Error error) =>
        Create(context, StatusFor(error.Type), error.Code, error.Message, error.Details);

    public static ProblemDetails Create(
        HttpContext context, int status, string code, string? detail, IReadOnlyDictionary<string, string[]>? errors = null)
    {
        var problem = new ProblemDetails
        {
            Type = TypeBase + code.Split('.')[0],
            Title = TitleFor(status),
            Status = status,
            Detail = detail,
        };
        problem.Extensions["code"] = code;
        problem.Extensions["correlationId"] = CorrelationIdMiddleware.Get(context);
        if (errors is { Count: > 0 })
        {
            problem.Extensions["errors"] = errors;
        }

        return problem;
    }

    public static ObjectResult ToResult(HttpContext context, Error error)
    {
        var problem = FromError(context, error);
        return new ObjectResult(problem) { StatusCode = problem.Status, ContentTypes = { "application/problem+json" } };
    }

    public static Task WriteAsync(HttpContext context, int status, string code, string? detail, IReadOnlyDictionary<string, string[]>? errors = null)
    {
        var problem = Create(context, status, code, detail, errors);
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(problem, (System.Text.Json.JsonSerializerOptions?)null, "application/problem+json");
    }

    private static string TitleFor(int status) => status switch
    {
        400 => "Validation failed",
        401 => "Unauthenticated",
        403 => "Forbidden",
        404 => "Not found",
        409 => "Conflict",
        422 => "Business rule violated",
        429 => "Too many requests",
        _ => "Server error",
    };
}
