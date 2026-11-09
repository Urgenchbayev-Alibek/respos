using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Errors;
using Restaurant.Domain.Common;

namespace Restaurant.Api.Controllers;

/// <summary>
/// Base for all API controllers: authenticated by default, maps <see cref="Result{T}"/> to HTTP.
/// Controllers only translate HTTP ↔ handler; no business logic, no DbContext.
/// </summary>
[ApiController]
[Authorize]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    public const string RoutePrefix = "api/v1/";

    /// <summary>200 with value, or ProblemDetails on failure.</summary>
    protected IActionResult OkOrProblem<T>(Result<T> result) =>
        result.IsSuccess ? Ok(result.Value) : Problem(result.Error);

    /// <summary>201 with value (Location omitted), or ProblemDetails.</summary>
    protected IActionResult CreatedOrProblem<T>(Result<T> result) =>
        result.IsSuccess ? StatusCode(StatusCodes.Status201Created, result.Value) : Problem(result.Error);

    /// <summary>202 Accepted, or ProblemDetails.</summary>
    protected IActionResult AcceptedOrProblem(Result result) =>
        result.IsSuccess ? StatusCode(StatusCodes.Status202Accepted) : Problem(result.Error);

    /// <summary>204, or ProblemDetails.</summary>
    protected IActionResult NoContentOrProblem(Result result) =>
        result.IsSuccess ? NoContent() : Problem(result.Error);

    protected ObjectResult Problem(Error error) => ApiProblems.ToResult(HttpContext, error);
}
