# ADR-0015 — Report exports: XLSX via ClosedXML, PDF via browser print

Status: accepted (F5, 2026-11-10)

## Context
F5 adds XLSX export for every report and PDF for the sales summary and the cash-shift Z-report
(`GET /reports/{name}/export?format=csv|xlsx|pdf`). The libraries must be permissively licensed and run in the
Linux container (`mcr.microsoft.com/dotnet/aspnet:8.0`) without extra native packages.

## Decision
- **XLSX: ClosedXML 0.104.2** (MIT, netstandard2.0, managed — DocumentFormat.OpenXml underneath, embedded fallback
  font for column sizing, no system fonts needed). It sits behind `Application.Abstractions.Reports.ISpreadsheetWriter`
  (`Infrastructure/Reports/ClosedXmlSpreadsheetWriter`), so Application stays library-free.
- **PDF: server-rendered, print-ready HTML + the browser's print dialog ("Save as PDF").** `format=pdf` returns
  `text/html` (A4 `@page` CSS, no scripts, every value HTML-encoded, response CSP `default-src 'none'; style-src 'unsafe-inline'`).
  The admin app fetches it through the api-client (auth + branch headers) and prints it from a hidden iframe.
- All formats are built from one format-neutral `ReportDocument` (sheets + summary) produced by the same handlers as
  the JSON endpoints, so numbers are identical across JSON / CSV / XLSX / print.

## Why not QuestPDF
QuestPDF's Community license is free only for organisations with **< 1 M USD annual gross revenue** (otherwise a paid
Professional/Enterprise license). The licensee is the company operating RestaurantOS — revenue growth would silently
make us non-compliant, and it adds a native SkiaSharp dependency (~10 MB, Linux libs). Browser printing gives
good typography, Cyrillic/Uzbek fonts and pagination for free. If server-generated PDF files become a requirement
(e-mailing reports, F7), revisit: QuestPDF with a paid license, or PdfSharp/MigraDoc (MIT).

## Consequences
- "PDF" needs a browser; there is no PDF byte stream API. Documented in the contract (`v2/F5-analytics.md`).
- CSV keeps the MVP format (stable camelCase headers, UTF-8 BOM, injection-safe). XLSX/print headers are localized
  by `?lang=ru|uz|en`; text cells in XLSX are always strings (never formulas), so no CSV-style prefixing is needed.
- Every export format requires `reports.export` (+ `reports.read`) and the `csv_export` plan feature.
