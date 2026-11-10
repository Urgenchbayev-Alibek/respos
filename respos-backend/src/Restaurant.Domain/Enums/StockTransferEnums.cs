namespace Restaurant.Domain.Enums;

public enum StockTransferStatus { Draft, Sent, Received, Cancelled }

/// <summary>Transfer as seen from the current branch.</summary>
public enum StockTransferDirection { Outgoing, Incoming }
