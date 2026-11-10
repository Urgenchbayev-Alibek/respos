/** Public QR-menu link of a table: `${landing}/menu/{slug}?table={number}`. */
export function tableMenuUrl(landingUrl: string, slug: string, tableNumber: string): string {
  const params = new URLSearchParams({ table: tableNumber });
  return `${landingUrl}/menu/${encodeURIComponent(slug)}?${params.toString()}`;
}
