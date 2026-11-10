using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Application.Features.Integrations.Outbound;
using Restaurant.Application.Features.Integrations.Settings;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>F7: organization integrations (Telegram, Eskiz SMS, SMTP), outbound log and error log. Org-level (no branch).</summary>
[Route(RoutePrefix + "integrations")]
[HasPermission(Permissions.Integrations.Manage)]
public sealed class IntegrationsController : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<IntegrationDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromServices] ListIntegrationsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListIntegrationsQuery(), ct));

    [HttpPut("{type}")]
    [ProducesResponseType<IntegrationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        string type, [FromBody] UpdateIntegrationCommand command, [FromServices] UpdateIntegrationHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Type = type }, ct));

    [HttpPost("{type}/test")]
    [ProducesResponseType<IntegrationTestResultDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Test(
        string type, [FromBody] TestIntegrationCommand? command, [FromServices] TestIntegrationHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync((command ?? new TestIntegrationCommand(null)) with { Type = type }, ct));

    [HttpGet("outbound-messages")]
    [ProducesResponseType<PagedResult<OutboundMessageDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> OutboundMessages(
        [FromQuery] ListOutboundMessagesQuery query, [FromServices] ListOutboundMessagesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("errors")]
    [ProducesResponseType<PagedResult<IntegrationErrorDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Errors(
        [FromQuery] ListIntegrationErrorsQuery query, [FromServices] ListIntegrationErrorsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query with { PlatformScope = false, OrganizationId = null }, ct));
}
