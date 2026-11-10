import QRCode from 'qrcode';

/** Public QR-menu link of a table: `${landing}/menu/{slug}?table={number}`. */
export function tableMenuUrl(landingUrl: string, slug: string, tableNumber: string): string {
  const params = new URLSearchParams({ table: tableNumber });
  return `${landingUrl}/menu/${encodeURIComponent(slug)}?${params.toString()}`;
}

/** SVG markup of a QR code (error correction M — survives a bit of dirt on a printed card). */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
}
