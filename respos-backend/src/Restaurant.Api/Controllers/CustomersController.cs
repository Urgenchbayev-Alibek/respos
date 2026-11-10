using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Customers.Common;
using Restaurant.Application.Features.Customers.Loyalty;
using Restaurant.Application.Features.Customers.Manage;
using Restaurant.Application.Features.Customers.Read;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Org-level guests (CRM) + loyalty settings (F1). <c>X-Branch-Id</c> optional (only sets the timezone for birthday flags).</summary>
[Route(RoutePrefix + "customers")]
public sealed class CustomersController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Customers.Read)]
    [ProducesResponseType<PagedResult<CustomerListItemDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListCustomersQuery query, [FromServices] ListCustomersHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Customers.Read)]
    [ProducesResponseType<CustomerDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetCustomerHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetCustomerQuery(id), ct));

    [HttpPost]
    [HasPermission(Permissions.Customers.Manage)]
    [ProducesResponseType<CustomerDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SaveCustomerCommand command, [FromServices] SaveCustomerHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Customers.Manage)]
    [ProducesResponseType<CustomerDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] SaveCustomerCommand command, [FromServices] SaveCustomerHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpDelete("{id:guid}")]
    [HasPermission(Permissions.Customers.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, [FromServices] DeleteCustomerHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new DeleteCustomerCommand(id), ct));

    [HttpGet("{id:guid}/orders")]
    [HasPermission(Permissions.Customers.Read)]
    [ProducesResponseType<PagedResult<CustomerOrderDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Orders(
        Guid id, [FromQuery] CustomerHistoryQuery query, [FromServices] CustomerOrdersHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query with { CustomerId = id }, ct));

    [HttpGet("{id:guid}/loyalty/transactions")]
    [HasPermission(Permissions.Customers.Read)]
    [ProducesResponseType<PagedResult<LoyaltyTransactionDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Ledger(
        Guid id, [FromQuery] CustomerHistoryQuery query, [FromServices] CustomerLedgerHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query with { CustomerId = id }, ct));
}

/// <summary>Loyalty program settings of the organization (F1).</summary>
[Route(RoutePrefix + "loyalty/settings")]
public sealed class LoyaltySettingsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Customers.Read, Permissions.Customers.Manage, Permissions.Customers.LoyaltyRedeem)]
    [ProducesResponseType<LoyaltySettingsDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get([FromServices] GetLoyaltySettingsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetLoyaltySettingsQuery(), ct));

    [HttpPut]
    [HasPermission(Permissions.Settings.Manage)]
    [ProducesResponseType<LoyaltySettingsDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        [FromBody] UpdateLoyaltySettingsCommand command, [FromServices] UpdateLoyaltySettingsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command, ct));
}
