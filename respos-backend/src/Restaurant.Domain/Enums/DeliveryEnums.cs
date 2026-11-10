namespace Restaurant.Domain.Enums;

/// <summary>Delivery lifecycle (separate from the order status): new → accepted → cooking → ready → on_the_way → delivered | cancelled.</summary>
public enum DeliveryStatus { New, Accepted, Cooking, Ready, OnTheWay, Delivered, Cancelled }

/// <summary>Why a guest pressed the button on the QR menu.</summary>
public enum WaiterCallReason { Call, Bill }

public enum WaiterCallStatus { Active, Acknowledged }
