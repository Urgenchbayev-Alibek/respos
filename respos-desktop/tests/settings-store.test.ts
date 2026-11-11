import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsStore } from '../src/main/settings-store';
import { DEFAULT_SETTINGS, type DesktopSettings } from '../src/shared/settings-schema';

let directory: string;
let file: string;
let warnings: string[];

function createStore(): SettingsStore {
  return new SettingsStore(file, (level, message) => {
    if (level !== 'info') warnings.push(message);
  });
}

async function readJson(): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'respos-settings-'));
  file = path.join(directory, 'nested', 'settings.json');
  warnings = [];
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('settings store', () => {
  it('starts with the defaults when there is no file and does not create one', async () => {
    const store = createStore();
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(await readdir(directory)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('persists updates and reads them back in a new instance', async () => {
    const store = createStore();
    await store.load();
    const saved = await store.update({
      serverUrl: 'http://192.168.1.10:5080',
      printer: 'XP-80C',
      silentPrint: true,
      language: 'uz',
      windowBounds: { x: 40, y: 60, width: 1366, height: 768, maximized: false },
    });
    expect(saved.serverUrl).toBe('http://192.168.1.10:5080');

    const reloaded = await createStore().load();
    const expected: DesktopSettings = {
      serverUrl: 'http://192.168.1.10:5080',
      printer: 'XP-80C',
      silentPrint: true,
      kiosk: false,
      autoStart: false,
      language: 'uz',
      windowBounds: { x: 40, y: 60, width: 1366, height: 768, maximized: false },
    };
    expect(reloaded).toEqual(expected);
    expect(await readJson()).toEqual(expected);
  });

  it('merges a patch into the current settings', async () => {
    const store = createStore();
    await store.load();
    await store.update({ serverUrl: 'https://api.example.uz', kiosk: true });
    const next = await store.update({ autoStart: true });
    expect(next).toMatchObject({ serverUrl: 'https://api.example.uz', kiosk: true, autoStart: true });
  });

  it('writes atomically: only settings.json is left in the folder', async () => {
    const store = createStore();
    await store.load();
    await store.update({ kiosk: true });
    await store.update({ kiosk: false });
    expect(await readdir(path.dirname(file))).toEqual(['settings.json']);
    expect((await readFile(file, 'utf8')).endsWith('}\n')).toBe(true);
  });

  it('serializes concurrent updates: none is lost', async () => {
    const store = createStore();
    await store.load();
    await Promise.all([
      store.update({ serverUrl: 'http://10.0.0.2:5080' }),
      store.update({ printer: 'POS-80' }),
      store.update({ silentPrint: true }),
      store.update({ kiosk: true }),
      store.update({ language: 'en' }),
      store.update({ windowBounds: { x: null, y: null, width: 1024, height: 700, maximized: true } }),
    ]);
    await store.flush();
    expect(await readJson()).toEqual({
      serverUrl: 'http://10.0.0.2:5080',
      printer: 'POS-80',
      silentPrint: true,
      kiosk: true,
      autoStart: false,
      language: 'en',
      windowBounds: { x: null, y: null, width: 1024, height: 700, maximized: true },
    });
    expect(await readdir(path.dirname(file))).toEqual(['settings.json']);
  });

  it('rejects an invalid patch and writes nothing', async () => {
    const store = createStore();
    await store.load();
    await store.update({ serverUrl: 'http://10.0.0.2:5080' });
    const before = await readFile(file, 'utf8');

    await expect(store.update({ serverUrl: 'ftp://10.0.0.2' })).rejects.toThrow(/serverUrl/);
    await expect(store.update({ serverUrl: 'http://admin:secret@10.0.0.2' })).rejects.toThrow(/serverUrl/);
    await expect(store.update({ language: 'de' as never })).rejects.toThrow(/language/);
    await expect(store.update({ windowBounds: { x: 0, y: 0, width: 10, height: 10, maximized: false } })).rejects.toThrow(/windowBounds/);

    expect(await readFile(file, 'utf8')).toBe(before);
    expect(store.get().serverUrl).toBe('http://10.0.0.2:5080');
    // The store keeps working after a rejected update.
    expect((await store.update({ kiosk: true })).kiosk).toBe(true);
  });

  it('sets a file that is not JSON aside and falls back to the defaults', async () => {
    const store = createStore();
    await store.load();
    await store.update({ kiosk: true });
    await writeFile(file, '{ "serverUrl": "http://10.0.0.2:5080", ');

    const reloaded = createStore();
    expect(await reloaded.load()).toEqual(DEFAULT_SETTINGS);
    expect((await readdir(path.dirname(file))).sort()).toEqual(['settings.corrupt.json']);
    expect(warnings.join(' ')).toContain('not valid JSON');
    // …and the next save creates a clean file again.
    await reloaded.update({ language: 'en' });
    expect(await readJson()).toMatchObject({ language: 'en', serverUrl: null });
  });

  it('validates each field of a hand-edited file on its own', async () => {
    const store = createStore();
    await store.load();
    await store.update({ kiosk: true });
    await writeFile(
      file,
      JSON.stringify({
        serverUrl: 'HTTP://192.168.1.10:5080/api/v1/',
        printer: 42,
        silentPrint: 'yes',
        kiosk: true,
        autoStart: true,
        language: 'kz',
        windowBounds: { x: 0, y: 0, width: 99_999, height: 800, maximized: false },
        apiToken: 'must-not-survive',
      }),
    );

    const reloaded = await createStore().load();
    expect(reloaded).toEqual({
      serverUrl: 'http://192.168.1.10:5080',
      printer: null,
      silentPrint: false,
      kiosk: true,
      autoStart: true,
      language: 'ru',
      windowBounds: null,
    });
    expect(warnings.join(' ')).toContain('printer, silentPrint, language, windowBounds');
  });

  it('never persists unknown keys', async () => {
    const store = createStore();
    await store.load();
    await store.update({ kiosk: true, ...({ password: 'secret' } as object) });
    expect(Object.keys((await readJson()) as object).sort()).toEqual(
      ['autoStart', 'kiosk', 'language', 'printer', 'serverUrl', 'silentPrint', 'windowBounds'].sort(),
    );
  });

  it('accepts a file with a UTF-8 byte order mark (saved by Notepad)', async () => {
    const store = createStore();
    await store.load();
    await store.update({ kiosk: false });
    await writeFile(file, `${String.fromCharCode(0xfeff)}${JSON.stringify({ serverUrl: 'https://api.example.uz', language: 'en' })}`);
    expect(await createStore().load()).toMatchObject({ serverUrl: 'https://api.example.uz', language: 'en' });
  });

  it('hands out copies: mutating a result does not change the store', async () => {
    const store = createStore();
    await store.load();
    await store.update({ windowBounds: { x: 1, y: 2, width: 800, height: 600, maximized: false } });
    const copy = store.get();
    copy.kiosk = true;
    if (copy.windowBounds) copy.windowBounds.width = 5000;
    expect(store.get().kiosk).toBe(false);
    expect(store.get().windowBounds?.width).toBe(800);
  });
});
