namespace Restaurant.Domain.Enums;

public enum OrganizationStatus { Active, Suspended, Closed }

public enum UserStatus { Active, Invited, Blocked, Deactivated }

public enum SubscriptionStatus { Trial, Active, PastDue, Suspended, Cancelled }

public enum DemoRequestStatus { New, Contacted, Closed }

public enum InventoryConsumptionTrigger { OnPayment }
