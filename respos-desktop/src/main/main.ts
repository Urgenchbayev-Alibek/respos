import path from 'node:path';
import { app, dialog } from 'electron';
import { LocalGateway, PREFERRED_GATEWAY_PORT } from '../gateway/local-gateway';
import { trustSystemCertificates } from './certificates';
import { DesktopApp } from './desktop-app';
import { mainStrings } from './i18n';
import { registerIpc } from './ipc';
import { createLogger } from './logger';
import { logDir, settingsFile, settingsUiDir, webDistDir } from './paths';
import { createPrintCapture } from './print-capture';
import { installSecurityPolicy } from './security';
import { SettingsStore } from './settings-store';
import { handleShellProtocol, registerShellScheme } from './shell-protocol';
import { E2E_SWITCH, remoteDebuggingRefused, resolveTestOverrides, type TestHookContext, type TestOverrides } from './test-hooks';

const APP_USER_MODEL_ID = 'uz.respos.desktop';

async function run(overrides: TestOverrides): Promise<void> {
  await app.whenReady();
  const log = createLogger(logDir());
  log('info', `RestaurantOS desktop ${app.getVersion()} starting (electron ${process.versions.electron ?? '?'})`);
  // A point-of-sale shell keeps running: an unexpected error is written to the log instead of a crash dialog.
  process.on('uncaughtException', (error) => log('error', `uncaught exception: ${error.stack ?? error.message}`));
  process.on('unhandledRejection', (reason) => log('error', `unhandled rejection: ${String(reason)}`));
  trustSystemCertificates(log);

  const store = new SettingsStore(settingsFile(), log);
  const settings = await store.load();

  const gateway = new LocalGateway({ staticDir: webDistDir(), preferredPort: overrides.gatewayPort, logger: log });
  const started = await gateway.start();
  gateway.setTarget(settings.serverUrl);
  log('info', `gateway listening on ${started.origin}${started.usedFallbackPort ? ' (fallback port)' : ''}`);

  const desktop = new DesktopApp({
    store,
    gateway,
    log,
    kioskFlag: app.commandLine.hasSwitch('kiosk'),
    printSink: overrides.printCaptureFile === null ? undefined : createPrintCapture(overrides.printCaptureFile, log),
  });
  installSecurityPolicy(desktop, log);
  handleShellProtocol(settingsUiDir());
  registerIpc(desktop, log);

  app.on('second-instance', () => desktop.focus());
  app.on('window-all-closed', () => app.quit());

  // Let a pending settings write (window bounds saved on close) reach the disk before the process ends.
  let flushed = false;
  app.on('will-quit', (event) => {
    if (flushed) return;
    event.preventDefault();
    void Promise.allSettled([store.flush(), gateway.stop()]).then(() => {
      flushed = true;
      // Never from inside this event's dispatch: Electron resets its "quitting" state only after the handler
      // returns, and a quit() issued before that is silently dropped (the process would stay alive, windowless).
      setImmediate(() => app.quit());
    });
  });

  await desktop.start();
}

const hookContext: TestHookContext = { isPackaged: app.isPackaged, e2eSwitch: app.commandLine.hasSwitch(E2E_SWITCH) };
const overrides = resolveTestOverrides(process.env, hookContext, PREFERRED_GATEWAY_PORT);
if (overrides.userDataDir !== null) app.setPath('userData', path.resolve(overrides.userDataDir));
const remoteDebugging = app.commandLine.hasSwitch('remote-debugging-port') || app.commandLine.hasSwitch('remote-debugging-pipe');
app.setAppUserModelId(APP_USER_MODEL_ID);
// Every renderer is sandboxed, whatever a window's own webPreferences say.
app.enableSandbox();
registerShellScheme();

if (remoteDebuggingRefused(hookContext, remoteDebugging)) {
  app.exit(1);
} else if (app.requestSingleInstanceLock()) {
  run(overrides).catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(message);
    dialog.showErrorBox(mainStrings('ru').startupFailed, error instanceof Error ? error.message : String(error));
    app.exit(1);
  });
} else {
  app.quit();
}
