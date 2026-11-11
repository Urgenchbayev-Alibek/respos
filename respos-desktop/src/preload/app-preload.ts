import { contextBridge, ipcRenderer } from 'electron';
import {
  APP_VERSION_ARG,
  BRIDGE_ORIGIN_ARG,
  DESKTOP_CHANNELS,
  PRINT_PAPERS,
  type PrintOptions,
  type PrintResult,
  type ResposDesktopApi,
} from '../shared/ipc';

/**
 * Preload of the main window (sandboxed, context-isolated). Exposes exactly the `window.resposDesktop`
 * contract from DESIGN.md and nothing else: no ipcRenderer, no Node, no generic "invoke".
 */

function argument(prefix: string): string | null {
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found === undefined ? null : found.slice(prefix.length);
}

function printOptions(options: unknown): PrintOptions {
  if (typeof options !== 'object' || options === null) return {};
  const paper: unknown = (options as { paper?: unknown }).paper;
  const known = PRINT_PAPERS.find((candidate) => candidate === paper);
  return known === undefined ? {} : { paper: known };
}

function isPrintResult(value: unknown): value is PrintResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as { ok?: unknown; reason?: unknown };
  return result.ok === true || (result.ok === false && typeof result.reason === 'string');
}

const api: ResposDesktopApi = {
  isDesktop: true,
  appVersion: argument(APP_VERSION_ARG) ?? '',
  openConnectionSettings: async (): Promise<void> => {
    await ipcRenderer.invoke(DESKTOP_CHANNELS.openConnectionSettings);
  },
  print: async (options?: PrintOptions): Promise<PrintResult> => {
    try {
      const result: unknown = await ipcRenderer.invoke(DESKTOP_CHANNELS.print, printOptions(options));
      return isPrintResult(result) ? result : { ok: false, reason: 'invalid_response' };
    } catch {
      // The web app treats `{ ok: false }` as "fall back to the print dialog".
      return { ok: false, reason: 'bridge_unavailable' };
    }
  },
};

// The bridge exists only on the gateway origin (main verifies the sender of every call as well).
if (window.location.origin === argument(BRIDGE_ORIGIN_ARG)) {
  contextBridge.exposeInMainWorld('resposDesktop', api);
}
