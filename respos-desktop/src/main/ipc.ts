import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { DESKTOP_CHANNELS, SETTINGS_CHANNELS } from '../shared/ipc';
import type { DesktopApp } from './desktop-app';
import {
  expectNoArguments,
  IpcRejection,
  parsePrintOptions,
  parseServerUrlArgument,
  parseSingleArgument,
} from './ipc-validation';
import type { Logger } from './logger';
import { isGatewayUrl, isSettingsPageUrl } from './url-policy';

type Scope = 'web-app' | 'settings';
type Handler = (event: IpcMainInvokeEvent, args: readonly unknown[]) => unknown;

/**
 * The whole IPC surface. A call is served only when all of these hold:
 * the channel is in the table below; the sender is the top frame of the window that owns the channel's scope;
 * that frame currently shows the expected origin (gateway origin for the web app, the bundled page for the
 * connection window); and the arguments pass the channel's validator.
 */
export function registerIpc(desktop: DesktopApp, log: Logger): void {
  const channels: Readonly<Record<string, { scope: Scope; handler: Handler }>> = Object.freeze({
    [DESKTOP_CHANNELS.openConnectionSettings]: {
      scope: 'web-app',
      handler: (_event, args) => {
        expectNoArguments(args);
        desktop.openConnectionSettings('manual');
      },
    },
    [DESKTOP_CHANNELS.print]: {
      scope: 'web-app',
      handler: (event, args) => desktop.print(event.sender, parsePrintOptions(args)),
    },
    [SETTINGS_CHANNELS.getState]: {
      scope: 'settings',
      handler: (event, args) => {
        expectNoArguments(args);
        return desktop.settingsState(event.sender);
      },
    },
    [SETTINGS_CHANNELS.listPrinters]: {
      scope: 'settings',
      handler: (event, args) => {
        expectNoArguments(args);
        return desktop.printers(event.sender);
      },
    },
    [SETTINGS_CHANNELS.testConnection]: {
      scope: 'settings',
      handler: (_event, args) => desktop.testConnection(parseServerUrlArgument(args)),
    },
    [SETTINGS_CHANNELS.save]: {
      scope: 'settings',
      handler: (_event, args) => desktop.saveSettings(parseSingleArgument(args)),
    },
    [SETTINGS_CHANNELS.close]: {
      scope: 'settings',
      handler: (_event, args) => {
        expectNoArguments(args);
        desktop.closeConnectionSettings();
      },
    },
  });

  const isTrustedSender = (event: IpcMainInvokeEvent, scope: Scope): boolean => {
    const frame = event.senderFrame;
    if (frame === null || frame !== event.sender.mainFrame) return false;
    if (scope === 'web-app') {
      return desktop.isWebAppContents(event.sender) && isGatewayUrl(frame.url, desktop.gatewayOrigin());
    }
    return desktop.isSettingsContents(event.sender) && isSettingsPageUrl(frame.url);
  };

  for (const [channel, { scope, handler }] of Object.entries(channels)) {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      if (!isTrustedSender(event, scope)) {
        log('warn', `ipc ${channel}: call from an untrusted sender was refused`);
        throw new Error('Forbidden');
      }
      try {
        return await handler(event, args);
      } catch (error) {
        // Only the generic message crosses the IPC boundary; details stay in the log.
        if (error instanceof IpcRejection) {
          log('warn', `ipc ${channel}: ${error.message}`);
          throw new Error('Bad request', { cause: error });
        }
        log('error', `ipc ${channel} failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error('Internal error', { cause: error });
      }
    });
  }
}
