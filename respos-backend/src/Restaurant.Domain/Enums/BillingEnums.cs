namespace Restaurant.Domain.Enums;

/// <summary>How an order was split into bills (F2).</summary>
public enum BillSplitMode { Items, Equal, Custom }

public enum OrderBillStatus { Open, Paid }

/// <summary>Provider-initiated payment (Payme/Click/Uzum): pending until the provider callback confirms it.</summary>
public enum PaymentIntentStatus { Pending, Completed, Cancelled }

/// <summary>Honest integration status shown in UI: «Не подключено» / «Тестовый режим» / «Подключено».</summary>
public enum PaymentProviderStatus { NotConnected, Test, Connected }
