using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Features.Payments.Providers;

namespace Restaurant.Api.Controllers;

/// <summary>
/// Provider webhooks (no JWT). Authenticity is verified by the adapter (Payme Basic auth, Click md5 sign); processing is
/// idempotent and audited. Responses use the provider's own protocol (HTTP 200 + provider error codes).
/// </summary>
[AllowAnonymous]
[Route(RoutePrefix + "payments/providers/{name}/callback")]
public sealed class PaymentCallbacksController : ApiControllerBase
{
    private const int MaxBodyBytes = 64 * 1024;

    [HttpPost]
    [RequestSizeLimit(MaxBodyBytes)]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> Callback(string name, [FromServices] ProviderCallbackHandler h, CancellationToken ct)
    {
        var form = new Dictionary<string, string>(StringComparer.Ordinal);
        var body = string.Empty;
        if (Request.HasFormContentType)
        {
            foreach (var field in await Request.ReadFormAsync(ct))
            {
                form[field.Key] = field.Value.ToString();
            }
        }
        else
        {
            using var reader = new StreamReader(Request.Body, Encoding.UTF8);
            body = await reader.ReadToEndAsync(ct);
        }

        var result = await h.HandleAsync(
            new ProviderCallbackCommand(name, new ProviderCallbackRequest(Request.Headers[HeaderNames.Authorization].ToString(), body, form)), ct);
        if (result.IsFailure)
        {
            return Problem(result.Error);
        }

        ProviderCallbackResponse response = result.Value;
        return new ContentResult { StatusCode = response.StatusCode, Content = response.Body, ContentType = response.ContentType };
    }
}
