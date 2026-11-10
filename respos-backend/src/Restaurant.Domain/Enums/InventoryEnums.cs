namespace Restaurant.Domain.Enums;

public enum UnitKind { Mass, Volume, Count }

public enum StockMovementType { Receipt, Consumption, WriteOff, Adjustment, InventoryCount, TransferIn, TransferOut }

public enum StockMovementSource { Order, Purchase, Manual, InventoryCount, Transfer }

public enum InventoryCountStatus { Draft, Completed }

public enum PurchaseOrderStatus { Draft, Submitted, PartiallyReceived, Received, Cancelled }
