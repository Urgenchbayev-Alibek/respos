using FluentValidation;
using Microsoft.AspNetCore.Mvc.Filters;
using Restaurant.Api.Errors;

namespace Restaurant.Api.Filters;

/// <summary>
/// Global filter: validates every action argument that has a registered FluentValidation validator.
/// Failure → 400 <c>validation.failed</c> with camelCase field errors. Runs after [RequireBranch].
/// </summary>
internal sealed class ValidationFilter(IServiceProvider services) : IAsyncActionFilter, IOrderedFilter
{
    public int Order => 100;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var argument in context.ActionArguments.Values.Where(a => a is not null))
        {
            var validatorType = typeof(IValidator<>).MakeGenericType(argument!.GetType());
            if (services.GetService(validatorType) is not IValidator validator)
            {
                continue;
            }

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            foreach (var group in result.Errors.GroupBy(e => ToCamelCase(e.PropertyName)))
            {
                errors[group.Key] = group.Select(e => e.ErrorMessage).ToArray();
            }
        }

        if (errors.Count > 0)
        {
            var problem = ApiProblems.Create(context.HttpContext, StatusCodes.Status400BadRequest,
                "validation.failed", "One or more fields are invalid.", errors);
            context.Result = new Microsoft.AspNetCore.Mvc.ObjectResult(problem) { StatusCode = 400 };
            return;
        }

        await next();
    }

    private static string ToCamelCase(string name) =>
        string.Join('.', name.Split('.').Select(p => p.Length == 0 ? p : char.ToLowerInvariant(p[0]) + p[1..]));
}
