using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Application.Features.Menu.Items;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "menu/items")]
public sealed class MenuItemsController : ApiControllerBase
{
    /// <summary>Multipart body cap: photo limit (2 MB) plus form overhead; the handler enforces the exact limit.</summary>
    private const long PhotoRequestLimit = MenuPhotoRules.MaxBytes + 64 * 1024;

    [HttpGet]
    [HasPermission(Permissions.Menu.Read)]
    [ProducesResponseType<PagedResult<MenuItemDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListMenuItemsQuery query, [FromServices] ListMenuItemsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Menu.Read)]
    [ProducesResponseType<MenuItemDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetMenuItemHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetMenuItemQuery(id), ct));

    [HttpPost]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<MenuItemDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SaveMenuItemCommand command, [FromServices] SaveMenuItemHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<MenuItemDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] SaveMenuItemCommand command, [FromServices] SaveMenuItemHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("{id:guid}/archive")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Archive(Guid id, [FromServices] ArchiveMenuItemHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new ArchiveMenuItemCommand(id), ct));

    [HttpPost("{id:guid}/availability")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<MenuItemDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetAvailability(
        Guid id, [FromBody] SetMenuItemAvailabilityCommand command, [FromServices] SetMenuItemAvailabilityHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { ItemId = id }, ct));

    [HttpPost("{id:guid}/photo")]
    [HasPermission(Permissions.Menu.Manage)]
    [RequestSizeLimit(PhotoRequestLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = PhotoRequestLimit)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType<MenuPhotoDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UploadPhoto(Guid id, IFormFile? file, [FromServices] UploadMenuItemPhotoHandler handler, CancellationToken ct)
    {
        if (file is null)
        {
            return Problem(MenuErrors.InvalidPhoto);
        }

        await using var stream = file.OpenReadStream();
        return OkOrProblem(await handler.HandleAsync(
            new UploadMenuItemPhotoCommand(id, stream, file.FileName, file.ContentType, file.Length), ct));
    }
}
