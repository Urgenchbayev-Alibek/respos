import { describe, expect, it } from 'vitest';
import { isGatewayAddress, isGatewayUrl, isSafeExternalUrl, isSettingsPageUrl, originForLog } from '../src/main/url-policy';

const GATEWAY = 'http://127.0.0.1:47615';

describe('pages a window may show', () => {
  it('accepts the gateway origin only, blob: documents of that origin included', () => {
    expect(isGatewayUrl(`${GATEWAY}/admin/reports?tab=sales`, GATEWAY)).toBe(true);
    expect(isGatewayUrl(`blob:${GATEWAY}/6f0c9a1e-0000-4000-8000-000000000000`, GATEWAY)).toBe(true);

    expect(isGatewayUrl('http://127.0.0.1:47616/admin', GATEWAY)).toBe(false);
    expect(isGatewayUrl('http://localhost:47615/admin', GATEWAY)).toBe(false);
    expect(isGatewayUrl('https://127.0.0.1:47615/admin', GATEWAY)).toBe(false);
    expect(isGatewayUrl('https://example.com/', GATEWAY)).toBe(false);
    expect(isGatewayUrl('blob:https://example.com/6f0c9a1e', GATEWAY)).toBe(false);
    expect(isGatewayUrl('about:blank', GATEWAY)).toBe(false);
    expect(isGatewayUrl('file:///C:/Windows/win.ini', GATEWAY)).toBe(false);
    expect(isGatewayUrl('not a url', GATEWAY)).toBe(false);
  });

  it('recognizes the bundled connection page by scheme and host', () => {
    expect(isSettingsPageUrl('respos-shell://settings/index.html')).toBe(true);
    expect(isSettingsPageUrl('respos-shell://other/index.html')).toBe(false);
    expect(isSettingsPageUrl('https://settings/index.html')).toBe(false);
    expect(isSettingsPageUrl('')).toBe(false);
  });
});

describe('links handed to the system browser', () => {
  it('lets plain web links out', () => {
    expect(isSafeExternalUrl('https://pay.example.uz/checkout?id=42', GATEWAY)).toBe(true);
    expect(isSafeExternalUrl('http://192.168.1.10:5174/menu/cafe?table=7', GATEWAY)).toBe(true);
    // Another program on a loopback port is not the gateway.
    expect(isSafeExternalUrl('http://localhost:5174/menu/cafe', GATEWAY)).toBe(true);
  });

  it('refuses everything that is not http(s), carries credentials or is oversized', () => {
    for (const url of [
      'file:///C:/Windows/win.ini',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ms-settings:privacy',
      'respos-shell://settings/index.html',
      'about:blank',
      'https://user:secret@example.com/',
      `https://example.com/${'a'.repeat(2048)}`,
      '',
      'example.com',
    ]) {
      expect(isSafeExternalUrl(url, GATEWAY), url).toBe(false);
    }
  });

  it('never hands the app itself to a browser, whichever way the gateway is addressed', () => {
    for (const url of [`${GATEWAY}/admin`, 'http://localhost:47615/admin', 'https://127.0.0.1:47615/', 'http://[::1]:47615/']) {
      expect(isGatewayAddress(url, GATEWAY), url).toBe(true);
      expect(isSafeExternalUrl(url, GATEWAY), url).toBe(false);
    }
    expect(isGatewayAddress('http://127.0.0.1:5081/health/ready', GATEWAY)).toBe(false);
    expect(isGatewayAddress('http://192.168.1.10:47615/', GATEWAY)).toBe(false);
    expect(isGatewayAddress('http://127.0.0.1/', GATEWAY)).toBe(false);
  });
});

describe('log lines', () => {
  it('keep the origin and drop the path and query (they may carry tokens)', () => {
    expect(originForLog('https://example.com/reset?token=secret')).toBe('https://example.com');
    expect(originForLog('nonsense')).toBe('an invalid URL');
  });
});
