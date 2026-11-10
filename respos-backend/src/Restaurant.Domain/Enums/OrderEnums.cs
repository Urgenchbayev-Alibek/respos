namespace Restaurant.Domain.Enums;

public enum OrderType { DineIn, Takeaway, Delivery }

public enum OrderStatus { Draft, Submitted, InProgress, PartiallyReady, Ready, Served, Paid, Cancelled }

public enum DiscountType { None, Amount, Percent }

public enum OrderItemStatus { New, Sent, Preparing, Ready, Served, Cancelled }

public enum KitchenTicketStatus { New, InProgress, Ready, Served, Cancelled }

public enum KitchenTicketItemStatus { New, Preparing, Ready, Cancelled }
