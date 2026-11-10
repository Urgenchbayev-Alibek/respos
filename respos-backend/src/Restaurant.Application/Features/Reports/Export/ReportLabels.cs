using Restaurant.Application.Abstractions.Reports;

namespace Restaurant.Application.Features.Reports.Export;

/// <summary>
/// Human-readable titles for XLSX / print exports in ru (default), uz (Latin) and en, chosen by <c>?lang=</c>.
/// CSV keeps the stable camelCase keys. Unknown keys fall back to the key itself.
/// </summary>
public sealed class ReportLabels
{
    public static readonly IReadOnlyList<string> Languages = ["ru", "uz", "en"];

    private static readonly Dictionary<string, (string Ru, string Uz, string En)> Texts = new(StringComparer.Ordinal)
    {
        // report titles
        ["report.sales"] = ("Выручка по дням", "Kunlar boʻyicha tushum", "Revenue by day"),
        ["report.top-items"] = ("Популярные блюда", "Ommabop taomlar", "Top items"),
        ["report.sales-by-category"] = ("Продажи по категориям", "Toifalar boʻyicha savdo", "Sales by category"),
        ["report.payment-methods"] = ("Способы оплаты", "Toʻlov usullari", "Payment methods"),
        ["report.stock"] = ("Остатки склада", "Ombor qoldiqlari", "Stock balances"),
        ["report.low-stock"] = ("Ниже минимума", "Minimumdan kam", "Low stock"),
        ["report.stock-movements"] = ("Движения склада", "Ombor harakatlari", "Stock movements"),
        ["report.cash-shifts"] = ("Кассовые смены", "Kassa smenalari", "Cash shifts"),
        ["report.sales-summary"] = ("Сводка продаж", "Savdo xulosasi", "Sales summary"),
        ["report.abc"] = ("ABC-анализ блюд", "Taomlar ABC tahlili", "ABC analysis"),
        ["report.food-cost"] = ("Фудкост блюд", "Taomlar tannarxi (food cost)", "Food cost"),
        ["report.waiters"] = ("Эффективность официантов", "Ofitsiantlar samaradorligi", "Waiter performance"),
        ["report.heatmap"] = ("Тепловая карта продаж", "Savdo issiqlik xaritasi", "Sales heatmap"),
        ["report.discounts-cancellations"] = ("Скидки и отмены", "Chegirmalar va bekor qilishlar", "Discounts & cancellations"),
        ["report.z-report"] = ("Z-отчёт смены", "Smena Z-hisoboti", "Shift Z-report"),
        // sheets & summary
        ["sheet.data"] = ("Данные", "Ma’lumotlar", "Data"),
        ["sheet.summary"] = ("Сводка", "Xulosa", "Summary"),
        ["sheet.byDay"] = ("По дням", "Kunlar boʻyicha", "By day"),
        ["sheet.grid"] = ("Сетка", "Jadval", "Grid"),
        ["sheet.discountedOrders"] = ("Скидки", "Chegirmalar", "Discounts"),
        ["sheet.cancelReasons"] = ("Причины отмен", "Bekor qilish sabablari", "Cancel reasons"),
        ["sheet.byWaiter"] = ("По официантам", "Ofitsiantlar boʻyicha", "By waiter"),
        ["sheet.methods"] = ("Оплаты", "Toʻlovlar", "Payments"),
        ["summary.period"] = ("Период", "Davr", "Period"),
        ["summary.previousPeriod"] = ("Предыдущий период", "Oldingi davr", "Previous period"),
        ["summary.branch"] = ("Филиал", "Filial", "Branch"),
        ["summary.generatedAt"] = ("Сформирован", "Yaratilgan", "Generated at"),
        ["summary.metric"] = ("Показатель", "Koʻrsatkich", "Metric"),
        ["summary.threshold"] = ("Порог фудкоста, %", "Food cost chegarasi, %", "Food cost threshold, %"),
        ["summary.aboveThreshold"] = ("Блюд выше порога", "Chegaradan yuqori taomlar", "Dishes above threshold"),
        // columns
        ["date"] = ("Дата", "Sana", "Date"),
        ["revenue"] = ("Выручка", "Tushum", "Revenue"),
        ["grossRevenue"] = ("Выручка до возвратов", "Qaytarishgacha tushum", "Gross revenue"),
        ["orders"] = ("Заказов", "Buyurtmalar", "Orders"),
        ["name"] = ("Название", "Nomi", "Name"),
        ["item"] = ("Блюдо", "Taom", "Item"),
        ["category"] = ("Категория", "Toifa", "Category"),
        ["quantity"] = ("Кол-во", "Miqdor", "Quantity"),
        ["method"] = ("Способ", "Usul", "Method"),
        ["amount"] = ("Сумма", "Summa", "Amount"),
        ["count"] = ("Операций", "Amallar", "Count"),
        ["refundedAmount"] = ("Возвраты", "Qaytarishlar", "Refunded"),
        ["ingredient"] = ("Ингредиент", "Ingredient", "Ingredient"),
        ["sku"] = ("Артикул", "Artikul", "SKU"),
        ["unit"] = ("Ед.", "Birlik", "Unit"),
        ["minQuantity"] = ("Минимум", "Minimum", "Minimum"),
        ["isLow"] = ("Мало", "Kam", "Low"),
        ["costPrice"] = ("Себестоимость ед.", "Birlik tannarxi", "Unit cost"),
        ["stockValue"] = ("Стоимость остатка", "Qoldiq qiymati", "Stock value"),
        ["type"] = ("Тип", "Turi", "Type"),
        ["openedAt"] = ("Открыта", "Ochilgan", "Opened"),
        ["openedBy"] = ("Открыл", "Ochgan", "Opened by"),
        ["closedAt"] = ("Закрыта", "Yopilgan", "Closed"),
        ["closedBy"] = ("Закрыл", "Yopgan", "Closed by"),
        ["status"] = ("Статус", "Holat", "Status"),
        ["openingAmount"] = ("Размен", "Boshlangʻich summa", "Opening amount"),
        ["cash"] = ("Наличные", "Naqd", "Cash"),
        ["card"] = ("Карта", "Karta", "Card"),
        ["other"] = ("Другое", "Boshqa", "Other"),
        ["refunds"] = ("Возвраты", "Qaytarishlar", "Refunds"),
        ["expectedCash"] = ("Ожидалось наличных", "Kutilgan naqd", "Expected cash"),
        ["actualCash"] = ("Фактически наличных", "Haqiqiy naqd", "Actual cash"),
        ["difference"] = ("Расхождение", "Farq", "Difference"),
        ["current"] = ("Текущий период", "Joriy davr", "Current period"),
        ["previous"] = ("Предыдущий период", "Oldingi davr", "Previous period"),
        ["deltaPercent"] = ("Δ, %", "Δ, %", "Δ, %"),
        ["previousDate"] = ("Дата (пред.)", "Sana (oldingi)", "Date (prev.)"),
        ["previousRevenue"] = ("Выручка (пред.)", "Tushum (oldingi)", "Revenue (prev.)"),
        ["previousOrders"] = ("Заказов (пред.)", "Buyurtmalar (oldingi)", "Orders (prev.)"),
        ["averageCheck"] = ("Средний чек", "Oʻrtacha chek", "Average check"),
        ["itemsSold"] = ("Продано позиций", "Sotilgan pozitsiyalar", "Items sold"),
        ["discountsAmount"] = ("Скидки", "Chegirmalar", "Discounts"),
        ["guests"] = ("Гостей", "Mehmonlar", "Guests"),
        ["cost"] = ("Себестоимость", "Tannarx", "Cost"),
        ["margin"] = ("Маржа", "Marja", "Margin"),
        ["value"] = ("Значение", "Qiymat", "Value"),
        ["sharePercent"] = ("Доля, %", "Ulush, %", "Share, %"),
        ["cumulativePercent"] = ("Накопл. доля, %", "Jamlangan ulush, %", "Cumulative, %"),
        ["class"] = ("Класс", "Sinf", "Class"),
        ["variant"] = ("Вариант", "Variant", "Variant"),
        ["price"] = ("Цена", "Narx", "Price"),
        ["recipeCost"] = ("Себестоимость порции", "Porsiya tannarxi", "Portion cost"),
        ["foodCostPercent"] = ("Фудкост, %", "Food cost, %", "Food cost, %"),
        ["marginAmount"] = ("Маржа", "Marja", "Margin"),
        ["marginPercent"] = ("Маржа, %", "Marja, %", "Margin, %"),
        ["hasRecipe"] = ("Есть техкарта", "Texkarta bor", "Has recipe"),
        ["aboveThreshold"] = ("Выше порога", "Chegaradan yuqori", "Above threshold"),
        ["waiter"] = ("Официант", "Ofitsiant", "Waiter"),
        ["cancelledOrders"] = ("Отменено заказов", "Bekor qilingan buyurtmalar", "Cancelled orders"),
        ["cancelledItems"] = ("Отменено позиций", "Bekor qilingan pozitsiyalar", "Cancelled items"),
        ["cancelledOrdersAmount"] = ("Сумма отменённых заказов", "Bekor qilingan buyurtmalar summasi", "Cancelled orders amount"),
        ["cancelledItemsAmount"] = ("Сумма отменённых позиций", "Bekor qilingan pozitsiyalar summasi", "Cancelled items amount"),
        ["discountedOrders"] = ("Заказов со скидкой", "Chegirmali buyurtmalar", "Discounted orders"),
        ["tips"] = ("Чаевые", "Choychaqa", "Tips"),
        ["weekday"] = ("День недели", "Hafta kuni", "Weekday"),
        ["hour"] = ("Час", "Soat", "Hour"),
        ["number"] = ("Номер", "Raqam", "Number"),
        ["discountType"] = ("Тип скидки", "Chegirma turi", "Discount type"),
        ["discountValue"] = ("Значение скидки", "Chegirma qiymati", "Discount value"),
        ["subtotal"] = ("Сумма до скидки", "Chegirmagacha summa", "Subtotal"),
        ["discountAmount"] = ("Скидка", "Chegirma", "Discount"),
        ["total"] = ("Итого", "Jami", "Total"),
        ["reason"] = ("Причина", "Sabab", "Reason"),
        ["items"] = ("Позиций", "Pozitsiyalar", "Items"),
        ["paymentsCount"] = ("Оплат", "Toʻlovlar soni", "Payments"),
        ["payments"] = ("Оплачено", "Toʻlangan", "Paid"),
        ["refundsCount"] = ("Возвратов", "Qaytarishlar soni", "Refunds count"),
        ["net"] = ("Итого", "Jami", "Net"),
        ["shiftOrders"] = ("Оплаченных заказов", "Toʻlangan buyurtmalar", "Paid orders"),
        // enum values
        ["enum.cash"] = ("Наличные", "Naqd", "Cash"),
        ["enum.card"] = ("Карта", "Karta", "Card"),
        ["enum.other"] = ("Другое", "Boshqa", "Other"),
        ["enum.open"] = ("Открыта", "Ochiq", "Open"),
        ["enum.closed"] = ("Закрыта", "Yopiq", "Closed"),
        ["enum.percent"] = ("Процент", "Foiz", "Percent"),
        ["enum.amount"] = ("Сумма", "Summa", "Amount"),
        ["enum.none"] = ("Нет", "Yoʻq", "None"),
        ["enum.revenue"] = ("По выручке", "Tushum boʻyicha", "By revenue"),
        ["enum.quantity"] = ("По количеству", "Miqdor boʻyicha", "By quantity"),
        ["enum.margin"] = ("По марже", "Marja boʻyicha", "By margin"),
        ["bool.true"] = ("Да", "Ha", "Yes"),
        ["bool.false"] = ("Нет", "Yoʻq", "No"),
        ["noReason"] = ("Без причины", "Sababsiz", "No reason"),
    };

    private static readonly Dictionary<string, string[]> Weekdays = new(StringComparer.Ordinal)
    {
        ["ru"] = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
        ["uz"] = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
        ["en"] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    };

    private ReportLabels(string language) => Language = language;

    public string Language { get; }

    public static ReportLabels For(string? language) =>
        new(language is not null && Languages.Contains(language) ? language : "ru");

    public string this[string key] => Texts.TryGetValue(key, out var text)
        ? Language switch { "uz" => text.Uz, "en" => text.En, _ => text.Ru }
        : key;

    /// <summary>Localized enum / bool value (<c>enum.&lt;snake_name&gt;</c>); unknown values stay snake_case.</summary>
    public string Value(object value)
    {
        var raw = value switch
        {
            bool b => b ? "bool.true" : "bool.false",
            Enum e => "enum." + CsvWriter.FormatCell(e),
            _ => value.ToString() ?? string.Empty,
        };
        var text = this[raw];
        return text == raw && raw.StartsWith("enum.", StringComparison.Ordinal) ? raw[5..] : text;
    }

    /// <summary>ISO weekday 1–7 → short localized name.</summary>
    public string Weekday(int isoWeekday) => Weekdays[Language][(isoWeekday - 1) % 7];

    public ReportColumn Column(string key, ReportCellKind kind = ReportCellKind.Text, string? titleKey = null) =>
        new(key, this[titleKey ?? key], kind);
}
