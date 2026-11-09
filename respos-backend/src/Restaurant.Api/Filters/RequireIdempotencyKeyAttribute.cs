using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Restaurant.Api.Errors;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Idempotency;

namespace Restaurant.Api.Filters;

/// <summary>
/// Requires an <c>Idempotency-Key</c> header (UUID). First request: executes and stores the 2xx response;
/// same key + same user + same body → replays the stored response; different body → 422
/// <c>idempotency.key_reused</c>; concurrent duplicate → 409 <c>idempotency.in_progress</c>.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class RequireIdempotencyKeyAttribute : Attribute, IFilterFactory
{
    public const string HeaderName = "Idempotency-Key";

    public bool IsReusable => false;

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider) =>
        ActivatorUtilities.CreateInstance<IdempotencyFilter>(serviceProvider);
}

internal sealed class IdempotencyFilter(
    IIdempotencyService idempotency,
    ITenantContext tenant,
    IOptions<Microsoft.AspNetCore.Mvc.JsonOptions> jsonOptions) : IAsyncResourceFilter
{
    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var http = context.HttpContext;
        var key = http.Request.Headers[RequireIdempotencyKeyAttribute.HeaderName].ToString();
        if (!Guid.TryParse(key, out _))
        {
            context.Result = Problem(http, 400, "idempotency.key_required", "A valid Idempotency-Key header (UUID) is required.");
            return;
        }

        if (tenant.UserId is not { } userId)
        {
            context.Result = Problem(http, 401, "auth.unauthenticated", "Authentication is required.");
            return;
        }

        var begin = await idempotency.BeginAsync(key, userId, await HashRequestAsync(http.Request), http.RequestAborted);
        switch (begin.State)
        {
            case IdempotencyState.Replay:
                http.Response.Headers["Idempotent-Replayed"] = "true";
                context.Result = new ContentResult
                {
                    StatusCode = begin.ResponseStatus,
                    Content = begin.ResponseBody,
                    ContentType = "application/json",
                };
                return;
            case IdempotencyState.Mismatch:
                context.Result = Problem(http, 422, "idempotency.key_reused", "Idempotency-Key was already used with a different request.");
                return;
            case IdempotencyState.InProgress:
                context.Result = Problem(http, 409, "idempotency.in_progress", "A request with this Idempotency-Key is in progress.");
                return;
        }

        var executed = await next();
        await StoreAsync(begin.RecordId, executed, http);
    }

    private async Task StoreAsync(Guid recordId, ResourceExecutedContext executed, HttpContext http)
    {
        var status = executed.Result switch
        {
            ObjectResult o => o.StatusCode ?? StatusCodes.Status200OK,
            StatusCodeResult s => s.StatusCode,
            _ => http.Response.StatusCode,
        };

        if (executed.Exception is null && status is >= 200 and < 300)
        {
            var body = executed.Result is ObjectResult { Value: { } value }
                ? JsonSerializer.Serialize(value, value.GetType(), jsonOptions.Value.JsonSerializerOptions)
                : null;
            await idempotency.CompleteAsync(recordId, status, body, CancellationToken.None);
            return;
        }

        await idempotency.AbandonAsync(recordId, CancellationToken.None);
    }

    private static async Task<string> HashRequestAsync(HttpRequest request)
    {
        request.EnableBuffering();
        using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
        var body = await reader.ReadToEndAsync(request.HttpContext.RequestAborted);
        request.Body.Position = 0;
        var material = $"{request.Method}\n{request.Path}{request.QueryString}\n{body}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(material)));
    }

    private static ObjectResult Problem(HttpContext http, int status, string code, string detail) =>
        new(ApiProblems.Create(http, status, code, detail)) { StatusCode = status };
}
