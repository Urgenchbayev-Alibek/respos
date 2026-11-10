using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Payments.Providers;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>F2 online payments: provider status/switches per branch, payment intents (link/QR), fiscal adapter status.</summary>
[Route(RoutePrefix + "payments")]
[RequireBranch]
public sealed class PaymentProvidersController : ApiControllerBase
{
    [HttpGet("providers")]
    [HasPermission(Permissions.Payments.Read, Permissions.Payments.Create, Permissions.Settings.Manage)]
    [ProducesResponseType<IReadOnlyList<PaymentProviderDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Providers([FromServices] ListPaymentProvidersHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ListPaymentProvidersQuery(), ct));

    [HttpPut("providers/{code}")]
    [HasPermission(Permissions.Settings.Manage)]
    [ProducesResponseType<IReadOnlyList<PaymentProviderDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetProvider(
        string code, [FromBody] SetBranchPaymentProviderCommand command, [FromServices] SetBranchPaymentProviderHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { Code = code }, ct));

    [HttpGet("fiscal")]
    [HasPermission(Permissions.Payments.Read, Permissions.Settings.Manage)]
    [ProducesResponseType<FiscalStatusDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Fiscal([FromServices] GetFiscalStatusHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new GetFiscalStatusQuery(), ct));

    [HttpPost("intents")]
    [HasPermission(Permissions.Payments.Create)]
    [ProducesResponseType<PaymentIntentDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateIntent(
        [FromBody] CreatePaymentIntentCommand command, [FromServices] CreatePaymentIntentHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command, ct));

    [HttpGet("intents")]
    [HasPermission(Permissions.Payments.Read, Permissions.Payments.Create)]
    [ProducesResponseType<IReadOnlyList<PaymentIntentDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListIntents([FromQuery] Guid orderId, [FromServices] ListPaymentIntentsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ListPaymentIntentsQuery(orderId), ct));

    [HttpGet("intents/{id:guid}")]
    [HasPermission(Permissions.Payments.Read, Permissions.Payments.Create)]
    [ProducesResponseType<PaymentIntentDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetIntent(Guid id, [FromServices] GetPaymentIntentHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new GetPaymentIntentQuery(id), ct));

    [HttpPost("intents/{id:guid}/cancel")]
    [HasPermission(Permissions.Payments.Create)]
    [ProducesResponseType<PaymentIntentDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelIntent(Guid id, [FromServices] CancelPaymentIntentHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new CancelPaymentIntentCommand { Id = id }, ct));
}
