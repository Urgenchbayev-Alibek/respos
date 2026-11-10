import { useEffect, useState } from 'react';
import { qrSvg } from '@/shared/lib/qr';

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
    qrSvg(value)
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
