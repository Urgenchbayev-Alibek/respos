/**
 * Which `<PrintArea id>` the next browser print job is for. `printArea(id)` marks the area and opens the
 * browser print dialog; the area renders its content on `beforeprint` and hides it again on `afterprint`.
 */
let requestedId: string | null = null;

/** Attribute on `<body>` while a thermal print job runs: hides the app, shows only the print area. */
export const PRINT_BODY_ATTRIBUTE = 'data-print-thermal';

export function requestedPrintId(): string | null {
  return requestedId;
}

export function clearPrintRequest(): void {
  requestedId = null;
}

/** Print one `<PrintArea id={id}>` (80 mm thermal layout) via the browser print dialog. */
export function printArea(id: string): void {
  requestedId = id;
  window.print();
}
