namespace Restaurant.Domain.Enums;

/// <summary>External integration of an organization (JSON/DB: <c>telegram</c>, <c>sms_eskiz</c>, <c>smtp</c>).</summary>
public enum IntegrationType { Telegram, SmsEskiz, Smtp }

/// <summary>Computed connection state shown in the UI: «Не подключено» / «Подключено» / «Ошибка».</summary>
public enum IntegrationStatus { NotConfigured, Connected, Error }

public enum OutboundChannel { Telegram, Sms, Email }

public enum OutboundStatus { Pending, Sent, Failed, Skipped }
