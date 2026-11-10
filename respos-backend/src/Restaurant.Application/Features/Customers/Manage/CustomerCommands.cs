using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Customers.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Customers;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Customers.Manage;

public sealed record SaveCustomerCommand(
    string Phone,
    string Name,
    DateOnly? Birthday,
    CustomerGender? Gender,
    string? Notes,
    IReadOnlyList<string>? Tags,
    bool MarketingConsent)
{
    [JsonIgnore]
    public Guid? Id { get; init; }
}

public sealed record DeleteCustomerCommand(Guid Id);

public sealed class SaveCustomerValidator : AbstractValidator<SaveCustomerCommand>
{
    public SaveCustomerValidator(IClock clock)
    {
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(CommonRules.PhoneMaxLength)
            .Must(p => CustomerPhone.TryNormalize(p, out _)).WithErrorCode("customer.invalid_phone")
            .WithMessage("Phone must be an Uzbekistan number (+998XXXXXXXXX).");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Birthday)
            .Must(b => b is null || (b.Value.Year >= 1900 && b.Value <= DateOnly.FromDateTime(clock.UtcNow)))
            .WithMessage("Birthday must be a past date.");
        RuleFor(x => x.Gender).IsInEnum();
        RuleFor(x => x.Notes).MaximumLength(2000);
        RuleFor(x => x.Tags).Must(t => t is null || t.Count <= Customer.MaxTags).WithMessage("Too many tags.");
        RuleForEach(x => x.Tags).NotEmpty().MaximumLength(Customer.TagMaxLength);
    }
}

/// <summary>
/// <c>POST /customers</c> / <c>PUT /customers/{id}</c> [customers.manage]: phone normalized to +998…, unique per org
/// (409 <c>customer.phone_taken</c>); audited without personal data.
/// </summary>
public sealed class SaveCustomerHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit, CustomerReadService reader)
    : IHandler<SaveCustomerCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> HandleAsync(SaveCustomerCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        if (!CustomerPhone.TryNormalize(request.Phone, out var phone))
        {
            return CustomerErrors.InvalidPhone;
        }

        Customer? customer = null;
        if (request.Id is { } id)
        {
            customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
            if (customer is null)
            {
                return CustomerErrors.NotFound;
            }
        }

        if (await db.Customers.AnyAsync(c => c.Phone == phone && c.Id != request.Id, cancellationToken))
        {
            return CustomerErrors.PhoneTaken;
        }

        if (customer is null)
        {
            customer = Customer.Create(orgId, phone, request.Name);
            db.Customers.Add(customer);
        }
        else
        {
            customer.SetPhone(phone);
            customer.Rename(request.Name);
        }

        customer.SetBirthday(request.Birthday);
        customer.Gender = request.Gender;
        customer.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        customer.SetTags(request.Tags);
        customer.MarketingConsent = request.MarketingConsent;
        audit.Log(request.Id is null ? "customer.created" : "customer.updated", nameof(Customer), customer.Id,
            new { tags = customer.Tags, customer.MarketingConsent });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(customer.Id, cancellationToken))!;
    }
}

/// <summary><c>DELETE /customers/{id}</c> [customers.manage]: only guests without orders or loyalty history (422 <c>customer.has_history</c>).</summary>
public sealed class DeleteCustomerHandler(IApplicationDbContext db, IAuditLogger audit) : IHandler<DeleteCustomerCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(DeleteCustomerCommand request, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
        if (customer is null)
        {
            return CustomerErrors.NotFound;
        }

        if (await db.Orders.AnyAsync(o => o.CustomerId == customer.Id, cancellationToken)
            || await db.LoyaltyTransactions.AnyAsync(t => t.CustomerId == customer.Id, cancellationToken))
        {
            return CustomerErrors.HasHistory;
        }

        db.Customers.Remove(customer);
        audit.Log("customer.deleted", nameof(Customer), customer.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
