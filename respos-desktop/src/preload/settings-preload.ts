import { contextBridge, ipcRenderer } from 'electron';
import {
  BRIDGE_ORIGIN_ARG,
  type ConnectionTestResult,
  type PrinterInfo,
  type ResposSettingsApi,
  type SaveSettingsResult,
  SETTINGS_CHANNELS,
  type SettingsState,
} from '../shared/ipc';
import type { EditableSettings } from '../shared/settings-schema';

/**
 * Preload of the connection window only. `window.resposSettings` is never present in the web app: this script
 * is attached to one window, checks the page address, and main verifies the sender of every call again.
 */

const api: ResposSettingsApi = {
  getState: () => ipcRenderer.invoke(SETTINGS_CHANNELS.getState) as Promise<SettingsState>,
  listPrinters: () => ipcRenderer.invoke(SETTINGS_CHANNELS.listPrinters) as Promise<PrinterInfo[]>,
  testConnection: (serverUrl: string) =>
    ipcRenderer.invoke(SETTINGS_CHANNELS.testConnection, serverUrl) as Promise<ConnectionTestResult>,
  save: (settings: EditableSettings) =>
    ipcRenderer.invoke(SETTINGS_CHANNELS.save, settings) as Promise<SaveSettingsResult>,
  close: async (): Promise<void> => {
    await ipcRenderer.invoke(SETTINGS_CHANNELS.close);
  },
};

const expected = process.argv.find((value) => value.startsWith(BRIDGE_ORIGIN_ARG))?.slice(BRIDGE_ORIGIN_ARG.length);
const here = `${window.location.protocol}//${window.location.host}`;

if (expected !== undefined && here === expected) {
  contextBridge.exposeInMainWorld('resposSettings', api);
}
