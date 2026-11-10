using System.Net;
using Restaurant.Application.Abstractions.Email;

namespace Restaurant.Application.Features.Integrations.Email;

/// <summary>
/// Transactional e-mails in RU and UZ (Latin). Both languages are always included; the recipient's preferred language
/// goes first. Bodies contain one-time links → <see cref="EmailMessage.ContainsSecret"/> = true.
/// </summary>
public static class EmailTemplates
{
    private sealed record Text(string Subject, string Greeting, string Intro, string Action, string Footer);

    private static readonly Text ResetRu = new("Восстановление пароля", "Здравствуйте!",
        "Вы запросили сброс пароля в RestaurantOS. Ссылка действует ограниченное время.", "Сбросить пароль",
        "Если вы не запрашивали сброс, просто проигнорируйте это письмо.");

    private static readonly Text ResetUz = new("Parolni tiklash", "Assalomu alaykum!",
        "Siz RestaurantOS parolini tiklashni so'radingiz. Havola cheklangan vaqt amal qiladi.", "Parolni tiklash",
        "Agar siz so'ramagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.");

    private static readonly Text InviteRu = new("Приглашение в RestaurantOS", "Здравствуйте!",
        "Вас пригласили в «{0}» в RestaurantOS. Примите приглашение и задайте пароль.", "Принять приглашение",
        "Если вы не ожидали приглашения, проигнорируйте это письмо.");

    private static readonly Text InviteUz = new("RestaurantOS'ga taklif", "Assalomu alaykum!",
        "Sizni RestaurantOS'dagi «{0}» ga taklif qilishdi. Taklifni qabul qiling va parol o'rnating.", "Taklifni qabul qilish",
        "Agar taklifni kutmagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.");

    public static EmailMessage PasswordReset(string to, string link, string? language) =>
        Build(to, link, Ordered(language, ResetRu, ResetUz), string.Empty);

    public static EmailMessage Invitation(string to, string link, string organizationName, string? language) =>
        Build(to, link, Ordered(language, InviteRu, InviteUz), organizationName);

    private static Text[] Ordered(string? language, Text ru, Text uz) =>
        string.Equals(language, "uz", StringComparison.OrdinalIgnoreCase) ? [uz, ru] : [ru, uz];

    private static EmailMessage Build(string to, string link, Text[] parts, string arg)
    {
        var subject = $"{parts[0].Subject} / {parts[1].Subject}";
        var text = string.Join("\n\n————————\n\n", parts.Select(p =>
            $"{p.Greeting}\n\n{string.Format(p.Intro, arg)}\n\n{p.Action}: {link}\n\n{p.Footer}"));
        var safeLink = WebUtility.HtmlEncode(link);
        var html = "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#1f2937\">"
                   + string.Join("<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:24px 0\">", parts.Select(p =>
                       $"<p>{WebUtility.HtmlEncode(p.Greeting)}</p><p>{WebUtility.HtmlEncode(string.Format(p.Intro, arg))}</p>"
                       + $"<p><a href=\"{safeLink}\" style=\"background:#C2410C;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none\">{WebUtility.HtmlEncode(p.Action)}</a></p>"
                       + $"<p style=\"color:#6b7280;font-size:13px\">{WebUtility.HtmlEncode(p.Footer)}</p>"))
                   + "</body></html>";
        return new EmailMessage(to, subject, text, ContainsSecret: true, HtmlBody: html);
    }
}
