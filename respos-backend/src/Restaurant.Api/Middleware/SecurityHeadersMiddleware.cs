namespace Restaurant.Api.Middleware;

/// <summary>Adds baseline security headers to every response (set on <c>OnStarting</c> so error responses get them too).</summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers["Referrer-Policy"] = "no-referrer";
            headers.XFrameOptions = "DENY";
            return Task.CompletedTask;
        });
        return next(context);
    }
}
