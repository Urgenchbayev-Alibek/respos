using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Reports.Tips;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>F2 tips report (branch timezone period, per waiter of the order). Tips are not revenue.</summary>
[Route(RoutePrefix + "reports/tips")]
[RequireBranch]
public sealed class TipsReportController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Reports.Read)]
    [ProducesResponseType<TipsReportDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Tips([FromQuery] TipsReportQuery query, [FromServices] TipsReportHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));
}
