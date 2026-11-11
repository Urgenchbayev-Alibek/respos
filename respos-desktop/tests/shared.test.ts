import { describe, expect, it } from 'vitest';
import { IpcRejection, parsePrintOptions, parseServerUrlArgument } from '../src/main/ipc-validation';
import { normalizeServerUrl } from '../src/shared/server-url';
import { parseWindowBounds, validateEditableSettings } from '../src/shared/settings-schema';

describe('server address', () => {
  it('normalizes to the origin', () => {
    expect(normalizeServerUrl('http://192.168.1.10:5080')).toEqual({ ok: true, url: 'http://192.168.1.10:5080' });
    expect(normalizeServerUrl('  https://API.example.uz/  ')).toEqual({ ok: true, url: 'https://api.example.uz' });
    expect(normalizeServerUrl('https://api.example.uz:443/api/v1?x=1#y')).toEqual({ ok: true, url: 'https://api.example.uz' });
    expect(normalizeServerUrl('http://[::1]:5080/swagger')).toEqual({ ok: true, url: 'http://[::1]:5080' });
  });

  it('assumes http when the scheme is omitted', () => {
    expect(normalizeServerUrl('192.168.1.10:5080')).toEqual({ ok: true, url: 'http://192.168.1.10:5080' });
    expect(normalizeServerUrl('server.local')).toEqual({ ok: true, url: 'http://server.local' });
    expect(normalizeServerUrl('localhost:5081')).toEqual({ ok: true, url: 'http://localhost:5081' });
  });

  it('rejects what cannot be a backend address', () => {
    expect(normalizeServerUrl('   ')).toEqual({ ok: false, error: 'empty' });
    expect(normalizeServerUrl('http://')).toEqual({ ok: false, error: 'invalid' });
    expect(normalizeServerUrl('http://exa mple.uz')).toEqual({ ok: false, error: 'invalid' });
    expect(normalizeServerUrl('http://host:99999')).toEqual({ ok: false, error: 'invalid' });
    expect(normalizeServerUrl(`http://${'a'.repeat(2100)}.uz`)).toEqual({ ok: false, error: 'invalid' });
    expect(normalizeServerUrl('ftp://192.168.1.10')).toEqual({ ok: false, error: 'unsupported_protocol' });
    expect(normalizeServerUrl('file:///C:/Windows')).toEqual({ ok: false, error: 'unsupported_protocol' });
    expect(normalizeServerUrl('javascript://alert(1)')).toEqual({ ok: false, error: 'unsupported_protocol' });
  });

  it('refuses credentials in the address (the settings file holds no secrets)', () => {
    expect(normalizeServerUrl('http://admin:secret@192.168.1.10:5080')).toEqual({ ok: false, error: 'credentials_not_allowed' });
    expect(normalizeServerUrl('https://user@api.example.uz')).toEqual({ ok: false, error: 'credentials_not_allowed' });
  });
});

describe('settings sent by the connection window', () => {
  const valid = {
    serverUrl: '192.168.1.10:5080',
    printer: 'XP-80C',
    silentPrint: true,
    kiosk: false,
    autoStart: true,
    language: 'uz',
  };

  it('accepts a complete payload and normalizes it', () => {
    expect(validateEditableSettings(valid)).toEqual({
      ok: true,
      value: { ...valid, serverUrl: 'http://192.168.1.10:5080' },
    });
    expect(validateEditableSettings({ ...valid, printer: '  ' })).toMatchObject({ ok: true, value: { printer: null } });
    expect(validateEditableSettings({ ...valid, printer: null })).toMatchObject({ ok: true, value: { printer: null } });
  });

  it('reports a bad server address with its own error code', () => {
    expect(validateEditableSettings({ ...valid, serverUrl: '' })).toEqual({ ok: false, error: 'empty' });
    expect(validateEditableSettings({ ...valid, serverUrl: 'ftp://x' })).toEqual({ ok: false, error: 'unsupported_protocol' });
    expect(validateEditableSettings({ ...valid, serverUrl: 'http://a:b@x' })).toEqual({ ok: false, error: 'credentials_not_allowed' });
  });

  it('refuses anything that is not exactly the editable settings', () => {
    const invalid: unknown[] = [
      null,
      'http://192.168.1.10:5080',
      [valid],
      { ...valid, windowBounds: { x: 0, y: 0, width: 800, height: 600, maximized: false } },
      { ...valid, extra: 1 },
      { serverUrl: valid.serverUrl },
      { ...valid, serverUrl: null },
      { ...valid, silentPrint: 'true' },
      { ...valid, kiosk: 1 },
      { ...valid, language: 'de' },
      { ...valid, printer: 7 },
      { ...valid, printer: 'bad\u0000name' },
      { ...valid, printer: 'x'.repeat(600) },
    ];
    for (const payload of invalid) {
      expect(validateEditableSettings(payload), JSON.stringify(payload)).toEqual({ ok: false, error: 'invalid_settings' });
    }
  });
});

describe('window bounds', () => {
  it('accepts sane bounds with or without a position', () => {
    expect(parseWindowBounds({ x: -1920, y: 0, width: 1280, height: 800, maximized: true })).toEqual({
      x: -1920,
      y: 0,
      width: 1280,
      height: 800,
      maximized: true,
    });
    expect(parseWindowBounds({ x: null, y: null, width: 480, height: 600, maximized: false })).toMatchObject({ x: null, y: null });
  });

  it('rejects everything else', () => {
    for (const value of [
      null,
      'x',
      { width: 1280, height: 800 },
      { x: 0, y: 0, width: 100, height: 800, maximized: false },
      { x: 0, y: 0, width: 1280.5, height: 800, maximized: false },
      { x: 0, y: null, width: 1280, height: 800, maximized: false },
      { x: 1e9, y: 0, width: 1280, height: 800, maximized: false },
      { x: 0, y: 0, width: 1280, height: 800, maximized: 'no' },
    ]) {
      expect(parseWindowBounds(value), JSON.stringify(value)).toBeNull();
    }
  });
});

describe('IPC argument validation', () => {
  it('accepts the print options of the contract', () => {
    expect(parsePrintOptions([])).toEqual({});
    expect(parsePrintOptions([undefined])).toEqual({});
    expect(parsePrintOptions([{}])).toEqual({});
    expect(parsePrintOptions([{ paper: 'receipt-80mm' }])).toEqual({ paper: 'receipt-80mm' });
    expect(parsePrintOptions([{ paper: 'a4' }])).toEqual({ paper: 'a4' });
  });

  it('rejects anything else', () => {
    const invalid: unknown[][] = [
      [{ paper: 'a3' }],
      [{ paper: 80 }],
      [{ paper: 'a4', deviceName: 'Some printer' }],
      [{ silent: true }],
      ['a4'],
      [['a4']],
      [{ paper: 'a4' }, 'extra'],
      [Object.create({ paper: 'a4' })],
    ];
    for (const args of invalid) {
      expect(() => parsePrintOptions(args), JSON.stringify(args)).toThrow(IpcRejection);
    }
  });

  it('takes exactly one bounded string as a server address', () => {
    expect(parseServerUrlArgument(['http://x'])).toBe('http://x');
    expect(() => parseServerUrlArgument([])).toThrow(IpcRejection);
    expect(() => parseServerUrlArgument([42])).toThrow(IpcRejection);
    expect(() => parseServerUrlArgument(['http://x', 'y'])).toThrow(IpcRejection);
    expect(() => parseServerUrlArgument(['x'.repeat(3000)])).toThrow(IpcRejection);
  });
});
