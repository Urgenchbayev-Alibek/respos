using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Users.ChangeUserStatus;
using Restaurant.Application.Features.Users.Common;
using Restaurant.Application.Features.Users.CreateUser;
using Restaurant.Application.Features.Users.GetUser;
using Restaurant.Application.Features.Users.InviteUser;
using Restaurant.Application.Features.Users.ListUsers;
using Restaurant.Application.Features.Users.UpdateUser;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "users")]
public sealed class UsersController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Users.Read)]
    [ProducesResponseType<PagedResult<UserDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListUsersQuery query, [FromServices] ListUsersHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Users.Read)]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetUserHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetUserQuery(id), ct));

    [HttpPost]
    [HasPermission(Permissions.Users.Create)]
    [ProducesResponseType<UserDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateUserCommand command, [FromServices] CreateUserHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpPost("invitations")]
    [HasPermission(Permissions.Users.Create)]
    [ProducesResponseType<InvitationCreatedDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Invite([FromBody] InviteUserCommand command, [FromServices] InviteUserHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Users.Update)]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateUserCommand command, [FromServices] UpdateUserHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("{id:guid}/block")]
    [HasPermission(Permissions.Users.Deactivate)]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Block(Guid id, [FromServices] ChangeUserStatusHandler handler, CancellationToken ct) =>
        ChangeStatus(id, UserStatusAction.Block, handler, ct);

    [HttpPost("{id:guid}/unblock")]
    [HasPermission(Permissions.Users.Deactivate)]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Unblock(Guid id, [FromServices] ChangeUserStatusHandler handler, CancellationToken ct) =>
        ChangeStatus(id, UserStatusAction.Unblock, handler, ct);

    [HttpPost("{id:guid}/deactivate")]
    [HasPermission(Permissions.Users.Deactivate)]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Deactivate(Guid id, [FromServices] ChangeUserStatusHandler handler, CancellationToken ct) =>
        ChangeStatus(id, UserStatusAction.Deactivate, handler, ct);

    private async Task<IActionResult> ChangeStatus(Guid id, UserStatusAction action, ChangeUserStatusHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ChangeUserStatusCommand(id, action), ct));
}
