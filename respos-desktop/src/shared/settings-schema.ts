import { normalizeServerUrl, type ServerUrlError } from './server-url';

export const LANGUAGES = ['ru', 'uz', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface WindowBounds {
  /** `null` = let the OS place the window. */
  x: number | null;
  y: number | null;
  width: number;
  height: number;
  maximized: boolean;
}

/** `%APPDATA%/RestaurantOS/settings.json`. Holds NO secrets (the session lives in the renderer's cookie jar). */
export interface DesktopSettings {
  /** Backend origin, `null` until the first run is completed. */
  serverUrl: string | null;
  /** System printer name for receipts, `null` = not chosen. */
  printer: string | null;
  silentPrint: boolean;
  kiosk: boolean;
  autoStart: boolean;
  /** Language of the shell's own UI (menu, connection window). The web app keeps its own setting. */
  language: Language;
  windowBounds: WindowBounds | null;
}

/** The part of the settings the connection window edits. */
export type EditableSettings = Omit<DesktopSettings, 'windowBounds'>;

export const DEFAULT_SETTINGS: Readonly<DesktopSettings> = Object.freeze({
  serverUrl: null,
  printer: null,
  silentPrint: false,
  kiosk: false,
  autoStart: false,
  language: 'ru',
  windowBounds: null,
});

export const MIN_WINDOW_WIDTH = 480;
export const MIN_WINDOW_HEIGHT = 600;
const MAX_WINDOW_SIZE = 16_384;
const MAX_COORDINATE = 100_000;
const MAX_PRINTER_NAME = 512;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function parsePrinter(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  // Control characters never occur in a printer name; refuse them instead of passing them on to the OS.
  if (trimmed.length > MAX_PRINTER_NAME || hasControlCharacter(trimmed)) return { ok: false };
  return { ok: true, value: trimmed };
}

/** Returns the bounds when every field is sane, otherwise `null`. Visibility on a display is checked by main. */
export function parseWindowBounds(value: unknown): WindowBounds | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height, maximized } = value;
  if (!isIntegerIn(width, MIN_WINDOW_WIDTH, MAX_WINDOW_SIZE)) return null;
  if (!isIntegerIn(height, MIN_WINDOW_HEIGHT, MAX_WINDOW_SIZE)) return null;
  if (typeof maximized !== 'boolean') return null;
  if (isIntegerIn(x, -MAX_COORDINATE, MAX_COORDINATE) && isIntegerIn(y, -MAX_COORDINATE, MAX_COORDINATE)) {
    return { x, y, width, height, maximized };
  }
  if (x === null && y === null) return { x: null, y: null, width, height, maximized };
  return null;
}

export interface ParsedSettings {
  settings: DesktopSettings;
  /** Names of the fields that were invalid and fell back to their default. */
  issues: string[];
}

/**
 * Lenient parser for the settings file: every field is validated on its own, a bad or missing field falls back
 * to its default (and is reported), unknown fields are dropped. A hand-edited file can never crash the shell.
 */
export function parseSettings(raw: unknown): ParsedSettings {
  if (!isRecord(raw)) return { settings: { ...DEFAULT_SETTINGS }, issues: ['<root>'] };
  const issues: string[] = [];
  const settings: DesktopSettings = { ...DEFAULT_SETTINGS };

  if (raw.serverUrl !== undefined && raw.serverUrl !== null) {
    const normalized = typeof raw.serverUrl === 'string' ? normalizeServerUrl(raw.serverUrl) : null;
    if (normalized?.ok) settings.serverUrl = normalized.url;
    else issues.push('serverUrl');
  }
  if (raw.printer !== undefined) {
    const printer = parsePrinter(raw.printer);
    if (printer.ok) settings.printer = printer.value;
    else issues.push('printer');
  }
  for (const key of ['silentPrint', 'kiosk', 'autoStart'] as const) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value === 'boolean') settings[key] = value;
    else issues.push(key);
  }
  if (raw.language !== undefined) {
    if (isLanguage(raw.language)) settings.language = raw.language;
    else issues.push('language');
  }
  if (raw.windowBounds !== undefined && raw.windowBounds !== null) {
    const bounds = parseWindowBounds(raw.windowBounds);
    if (bounds) settings.windowBounds = bounds;
    else issues.push('windowBounds');
  }
  return { settings, issues };
}

export type EditableSettingsError = ServerUrlError | 'invalid_settings';
export type EditableSettingsResult =
  | { ok: true; value: EditableSettings }
  | { ok: false; error: EditableSettingsError };

const EDITABLE_KEYS: readonly (keyof EditableSettings)[] = [
  'serverUrl',
  'printer',
  'silentPrint',
  'kiosk',
  'autoStart',
  'language',
];

/**
 * Strict validator for what the connection window sends over IPC: exactly the editable keys, exact types,
 * a usable server address. Anything else is refused as a whole (nothing is saved).
 */
export function validateEditableSettings(raw: unknown): EditableSettingsResult {
  if (!isRecord(raw)) return { ok: false, error: 'invalid_settings' };
  const keys = Object.keys(raw);
  if (keys.length !== EDITABLE_KEYS.length || !EDITABLE_KEYS.every((key) => keys.includes(key))) {
    return { ok: false, error: 'invalid_settings' };
  }
  if (typeof raw.serverUrl !== 'string') return { ok: false, error: 'invalid_settings' };
  const serverUrl = normalizeServerUrl(raw.serverUrl);
  if (!serverUrl.ok) return { ok: false, error: serverUrl.error };

  const printer = parsePrinter(raw.printer);
  const { silentPrint, kiosk, autoStart, language } = raw;
  if (
    !printer.ok ||
    typeof silentPrint !== 'boolean' ||
    typeof kiosk !== 'boolean' ||
    typeof autoStart !== 'boolean' ||
    !isLanguage(language)
  ) {
    return { ok: false, error: 'invalid_settings' };
  }
  return {
    ok: true,
    value: { serverUrl: serverUrl.url, printer: printer.value, silentPrint, kiosk, autoStart, language },
  };
}
