using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Domain.Entities.Delivery;

/// <summary>
/// Delivery details of an order of type <c>delivery</c> (1:1 with <see cref="Orders.Order"/>). The delivery status is
/// separate from the order status and changes only through <see cref="ChangeStatus"/> (invalid → 409).
/// </summary>
public class OrderDelivery : AuditableEntity, IBranchScoped
{
    private static readonly Dictionary<DeliveryStatus, DeliveryStatus[]> Allowed = new()
    {
        [DeliveryStatus.New] = [DeliveryStatus.Accepted, DeliveryStatus.Cancelled],
        [DeliveryStatus.Accepted] = [DeliveryStatus.Cooking, DeliveryStatus.Ready, DeliveryStatus.Cancelled],
        [DeliveryStatus.Cooking] = [DeliveryStatus.Ready, DeliveryStatus.Cancelled],
        [DeliveryStatus.Ready] = [DeliveryStatus.OnTheWay, DeliveryStatus.Cancelled],
        [DeliveryStatus.OnTheWay] = [DeliveryStatus.Delivered, DeliveryStatus.Cancelled],
        [DeliveryStatus.Delivered] = [],
        [DeliveryStatus.Cancelled] = [],
    };

    private OrderDelivery()
    {
    }

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; private set; }
    public Guid OrderId { get; private set; }

    public string CustomerName { get; private set; } = string.Empty;

    /// <summary>Normalized E.164 (e.g. <c>+998901234567</c>).</summary>
    public string CustomerPhone { get; private set; } = string.Empty;

    public string Address { get; private set; } = string.Empty;
    public string? Entrance { get; private set; }
    public string? Floor { get; private set; }
    public string? Apartment { get; private set; }
    public string? Comment { get; private set; }

    public Guid? CourierId { get; private set; }
    public DeliveryStatus Status { get; private set; } = DeliveryStatus.New;
    public DateTime StatusChangedAt { get; private set; }
    public DateTime? AcceptedAt { get; private set; }
    public DateTime? CookingAt { get; private set; }
    public DateTime? ReadyAt { get; private set; }
    public DateTime? OnTheWayAt { get; private set; }
    public DateTime? DeliveredAt { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public string? CancelReason { get; private set; }

    /// <summary>Concurrency token mapped to Postgres <c>xmin</c>.</summary>
    public uint RowVersion { get; private set; }

    public bool IsClosed => Status is DeliveryStatus.Delivered or DeliveryStatus.Cancelled;

    public static OrderDelivery Create(Guid organizationId, Guid branchId, Guid orderId, DeliveryAddress details, DateTime utcNow)
    {
        var delivery = new OrderDelivery
        {
            OrganizationId = organizationId,
            BranchId = branchId,
            OrderId = orderId,
            StatusChangedAt = utcNow,
        };
        delivery.ApplyDetails(details);
        return delivery;
    }

    public static bool CanTransition(DeliveryStatus from, DeliveryStatus to) => Allowed[from].Contains(to);

    public static IReadOnlyList<DeliveryStatus> TargetsFrom(DeliveryStatus from) => Allowed[from];

    public void UpdateDetails(DeliveryAddress details)
    {
        EnsureOpen();
        ApplyDetails(details);
    }

    /// <summary>Assigns (or clears with null) the courier; not allowed once delivered/cancelled or while on the way.</summary>
    public void AssignCourier(Guid? courierId)
    {
        EnsureOpen();
        if (Status == DeliveryStatus.OnTheWay && courierId is null)
        {
            throw new DomainException(DeliveryErrors.CourierRequired);
        }

        CourierId = courierId;
    }

    /// <summary>Moves to <paramref name="target"/>; on_the_way needs a courier, cancelled needs a reason.</summary>
    public void ChangeStatus(DeliveryStatus target, DateTime utcNow, string? reason = null)
    {
        if (!CanTransition(Status, target))
        {
            throw new DomainException(DeliveryErrors.InvalidTransition(Status, target));
        }

        if (target == DeliveryStatus.OnTheWay && CourierId is null)
        {
            throw new DomainException(DeliveryErrors.CourierRequired);
        }

        if (target == DeliveryStatus.Cancelled)
        {
            if (string.IsNullOrWhiteSpace(reason))
            {
                throw new DomainException(DeliveryErrors.CancelReasonRequired);
            }

            CancelReason = reason.Trim();
        }

        Status = target;
        StatusChangedAt = utcNow;
        Stamp(target, utcNow);
    }

    private void Stamp(DeliveryStatus status, DateTime utcNow)
    {
        switch (status)
        {
            case DeliveryStatus.Accepted: AcceptedAt = utcNow; break;
            case DeliveryStatus.Cooking: CookingAt = utcNow; break;
            case DeliveryStatus.Ready: ReadyAt = utcNow; break;
            case DeliveryStatus.OnTheWay: OnTheWayAt = utcNow; break;
            case DeliveryStatus.Delivered: DeliveredAt = utcNow; break;
            case DeliveryStatus.Cancelled: CancelledAt = utcNow; break;
        }
    }

    private void ApplyDetails(DeliveryAddress details)
    {
        CustomerName = details.CustomerName.Trim();
        CustomerPhone = details.CustomerPhone;
        Address = details.Address.Trim();
        Entrance = Clean(details.Entrance);
        Floor = Clean(details.Floor);
        Apartment = Clean(details.Apartment);
        Comment = Clean(details.Comment);
    }

    private void EnsureOpen()
    {
        if (IsClosed)
        {
            throw new DomainException(DeliveryErrors.Closed);
        }
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

/// <summary>Customer + address part of a delivery (phone already normalized).</summary>
public sealed record DeliveryAddress(
    string CustomerName,
    string CustomerPhone,
    string Address,
    string? Entrance,
    string? Floor,
    string? Apartment,
    string? Comment);
