using System.Globalization;
using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Application.Features.Reservations.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Public.Reservations;

/// <summary><c>GET /public/branches/{branchSlug}/availability?date=&amp;guests=</c> (anonymous; slug = F3 <c>Branch.Slug</c>).</summary>
public sealed record PublicAvailabilityQuery
{
    [JsonIgnore]
    public string BranchSlug { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public int Guests { get; init; } = 2;
}

public sealed class PublicAvailabilityQueryValidator : AbstractValidator<PublicAvailabilityQuery>
{
    public PublicAvailabilityQueryValidator()
    {
        RuleFor(x => x.Date).NotEmpty();
        RuleFor(x => x.Guests).InclusiveBetween(1, ReservationLimits.MaxGuests);
    }
}

/// <summary>Slot without table details (never exposed publicly).</summary>
public sealed record PublicSlotDto(string Time, DateTime StartsAt, bool Available);

public sealed record PublicAvailabilityDto(
    string BranchSlug, string BranchName, DateOnly Date, string Timezone, int DurationMinutes, int MaxGuests, IReadOnlyList<PublicSlotDto> Slots);

/// <summary>
/// <c>POST /public/branches/{branchSlug}/reservations</c>. <c>date</c> + <c>time</c> are branch-local (<c>YYYY-MM-DD</c>, <c>HH:mm</c>).
/// <c>website</c> is a honeypot: when filled the request is answered like a success but nothing is stored.
/// </summary>
public sealed record CreatePublicReservationCommand(
    DateOnly Date, string Time, int Guests, string Name, string Phone, string? Comment, string? Website)
{
    [JsonIgnore]
    public string BranchSlug { get; init; } = string.Empty;

    public TimeOnly? LocalTime =>
        TimeOnly.TryParseExact(Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t) ? t : null;
}

public sealed class CreatePublicReservationValidator : AbstractValidator<CreatePublicReservationCommand>
{
    public CreatePublicReservationValidator()
    {
        RuleFor(x => x.Date).NotEmpty();
        RuleFor(x => x.Time).NotEmpty().Must((cmd, _) => cmd.LocalTime is not null).WithMessage("Use HH:mm.");
        RuleFor(x => x.Guests).InclusiveBetween(1, ReservationLimits.MaxGuests);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(CommonRules.PhoneMaxLength)
            .Must(p => PhoneNumbers.Normalize(p) is not null).WithMessage("Invalid phone number.");
        RuleFor(x => x.Comment).MaximumLength(ReservationLimits.CommentMaxLength);
        RuleFor(x => x.Website).MaximumLength(500);
    }
}

public sealed record PublicReservationCreatedDto(
    Guid ReservationId, ReservationStatus Status, DateTime StartsAt, DateTime EndsAt, int Guests, string BranchName);

public static class PublicReservationErrors
{
    public static readonly Error InvalidDate =
        Error.Validation("reservation.invalid_date", "The date is in the past or too far ahead.");

    public static readonly Error InvalidTime =
        Error.Validation("reservation.invalid_time", "The time is outside booking hours or not on the slot grid.");

    public static readonly Error TooManyGuests =
        Error.BusinessRule("reservation.too_many_guests", "Large parties must call the restaurant.");

    public static readonly Error SlotUnavailable =
        Error.Conflict("reservation.slot_unavailable", "No free table for this time. Choose another slot.");
}
