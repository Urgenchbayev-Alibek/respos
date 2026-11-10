using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Procurement.Purchases;
using Restaurant.Application.Features.Procurement.Suggestions;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Purchase suggestions of the X-Branch-Id branch (F4).</summary>
[Route(RoutePrefix + "purchases/suggestions")]
[RequireBranch]
public sealed class PurchaseSuggestionsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Purchases.Read)]
    [ProducesResponseType<PurchaseSuggestionsDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(
        [FromQuery] GetPurchaseSuggestionsQuery query, [FromServices] GetPurchaseSuggestionsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost("apply")]
    [HasPermission(Permissions.Purchases.Manage)]
    [ProducesResponseType<IReadOnlyList<PurchaseDto>>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Apply(
        [FromBody] ApplyPurchaseSuggestionsCommand command, [FromServices] ApplyPurchaseSuggestionsHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));
}
