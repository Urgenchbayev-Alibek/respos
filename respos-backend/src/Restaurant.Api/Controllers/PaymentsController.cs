using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Application.Features.Payments.ListPayments;
using Restaurant.Application.Features.Payments.RefundPayment;
using Restaurant.Application.Features.Payments.RegisterPayment;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "payments")]
[RequireBranch]
public sealed class PaymentsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Payments.Read)]
    [ProducesResponseType<PagedResult<PaymentDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListPaymentsQuery query, [FromServices] ListPaymentsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    [HttpPost]
    [HasPermission(Permissions.Payments.Create)]
    [RequireIdempotencyKey]
    [ProducesResponseType<PaymentDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterPaymentCommand command,
        [FromHeader(Name = RequireIdempotencyKeyAttribute.HeaderName)] string idempotencyKey,
        [FromServices] RegisterPaymentHandler h,
        CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command with { IdempotencyKey = idempotencyKey }, ct));

    [HttpPost("{id:guid}/refunds")]
    [HasPermission(Permissions.Payments.Refund)]
    [RequireIdempotencyKey]
    [ProducesResponseType<RefundDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Refund(
        Guid id, [FromBody] RefundPaymentCommand command, [FromServices] RefundPaymentHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command with { PaymentId = id }, ct));
}
