using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Customers.Common;

/// <summary>Row of <c>GET /customers</c>; stats are computed from paid orders of all branches of the org.</summary>
public sealed record CustomerListItemDto(
    Guid Id,
    string Name,
    string Phone,
    DateOnly? Birthday,
    IReadOnlyList<string> Tags,
    bool IsVip,
    bool IsBirthdayToday,
    bool IsBirthdaySoon,
    int Visits,
    decimal TotalSpent,
    decimal AverageCheck,
    DateTime? LastVisitAt,
    decimal Points,
    DateTime CreatedAt);

public sealed record CustomerStatsDto(int Visits, decimal TotalSpent, decimal AverageCheck, DateTime? LastVisitAt);

public sealed record CustomerLoyaltyDto(decimal Points, decimal LifetimeEarned, decimal LifetimeRedeemed);

/// <summary>Guest card (<c>GET /customers/{id}</c>, create/update responses).</summary>
public sealed record CustomerDto(
    Guid Id,
    string Name,
    string Phone,
    DateOnly? Birthday,
    CustomerGender? Gender,
    string? Notes,
    IReadOnlyList<string> Tags,
    bool MarketingConsent,
    bool IsVip,
    bool IsBirthdayToday,
    bool IsBirthdaySoon,
    DateTime CreatedAt,
    CustomerStatsDto Stats,
    CustomerLoyaltyDto Loyalty);

/// <summary><c>OrderDto.customer</c> summary (badges in waiter/cashier screens).</summary>
public sealed record OrderCustomerDto(Guid Id, string Name, string Phone, bool IsBirthdayToday, bool IsVip, decimal Points);

/// <summary>Order in the guest card history (all branches).</summary>
public sealed record CustomerOrderDto(
    Guid Id,
    int Number,
    Guid BranchId,
    string? BranchName,
    DateOnly BusinessDate,
    OrderType Type,
    OrderStatus Status,
    decimal Total,
    decimal PaidAmount,
    decimal LoyaltyDiscountAmount,
    DateTime OpenedAt,
    DateTime? ClosedAt);

public sealed record LoyaltyTransactionDto(
    Guid Id,
    LoyaltyTransactionType Type,
    LoyaltyReason Reason,
    decimal Points,
    decimal BalanceAfter,
    Guid? OrderId,
    int? OrderNumber,
    DateTime? ExpiresAt,
    DateTime CreatedAt,
    string? CreatedByName);

public sealed record LoyaltySettingsDto(bool IsEnabled, decimal EarnPercent, decimal MaxRedeemPercent, decimal MinOrderAmount, int? PointsExpiryDays);

/// <summary><c>GET /orders/{id}/loyalty</c>: what the cashier may redeem on this order right now.</summary>
public sealed record OrderLoyaltyDto(
    bool IsEnabled,
    Guid? CustomerId,
    decimal Points,
    decimal MaxRedeemable,
    decimal Redeemed,
    decimal ExpectedEarn,
    decimal MinOrderAmount,
    decimal MaxRedeemPercent);
