import QRCode from 'qrcode';

/**
 * The one QR generator of the app (table QR sheets, online payment links): SVG markup rendered locally (no network),
 * error correction M (survives a bit of dirt on a printed card), black on white for reliable scanning in both themes.
 */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#000000', light: '#ffffff' } });
}
