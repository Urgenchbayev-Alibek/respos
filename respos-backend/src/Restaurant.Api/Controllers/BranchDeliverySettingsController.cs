using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Features.Delivery.Settings;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Public QR-menu slug + delivery fee of a branch (org-level, like <c>/branches/{id}/settings</c>).</summary>
[Route(RoutePrefix + "branches/{id:guid}/delivery-settings")]
public sealed class BranchDeliverySettingsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Settings.Manage)]
    [ProducesResponseType<DeliverySettingsDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetDeliverySettingsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new GetDeliverySettingsQuery(id), ct));

    [HttpPut]
    [HasPermission(Permissions.Settings.Manage)]
    [ProducesResponseType<DeliverySettingsDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateDeliverySettingsCommand command, [FromServices] UpdateDeliverySettingsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { BranchId = id }, ct));
}
