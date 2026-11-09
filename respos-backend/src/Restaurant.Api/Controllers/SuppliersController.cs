using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Procurement.Suppliers;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Org-level suppliers (archive only, never deleted).</summary>
[Route(RoutePrefix + "suppliers")]
public sealed class SuppliersController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Suppliers.Read)]
    [ProducesResponseType<PagedResult<SupplierDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListSuppliersQuery query, [FromServices] ListSuppliersHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost]
    [HasPermission(Permissions.Suppliers.Manage)]
    [ProducesResponseType<SupplierDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SaveSupplierCommand command, [FromServices] SaveSupplierHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Suppliers.Manage)]
    [ProducesResponseType<SupplierDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] SaveSupplierCommand command, [FromServices] SaveSupplierHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("{id:guid}/archive")]
    [HasPermission(Permissions.Suppliers.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Archive(Guid id, [FromServices] ArchiveSupplierHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new ArchiveSupplierCommand(id), ct));
}
