import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export interface QrCodeProps {
  value: string;
  /** Accessible description of what the code is for. */
  alt: string;
  size?: number;
  className?: string;
}

/** QR code rendered locally as SVG (no network). Dark modules on white for reliable scanning in both themes. */
export function QrCode({ value, alt, size = 200, className }: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then((markup) => {
        if (active) setSvg(markup);
      })
      .catch(() => {
        if (active) setSvg(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (!svg) return null;
  return (
    <img
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
      alt={alt}
      width={size}
      height={size}
      className={className}
      data-testid="qr-code"
    />
  );
}
