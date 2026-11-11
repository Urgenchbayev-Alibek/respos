import { app, session, shell, type WebContents } from 'electron';
import type { Logger } from './logger';
import { isGatewayUrl, isSafeExternalUrl, isSettingsPageUrl, originForLog } from './url-policy';

/** Permissions a page may get. Everything else (camera, microphone, geolocation, notifications, …) is denied. */
const WEB_APP_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);
const SHELL_PAGE_PERMISSIONS = new Set<string>();

export interface SecurityPolicy {
  /** `http://127.0.0.1:<port>` */
  gatewayOrigin(): string;
  /** Which page a window is allowed to show: the web app, the bundled connection page, or nothing. */
  roleOf(contents: WebContents): 'web-app' | 'settings' | 'unknown';
}

function isAllowedPermission(permission: string, requestingUrl: string | undefined, policy: SecurityPolicy): boolean {
  if (requestingUrl === undefined) return false;
  if (isGatewayUrl(requestingUrl, policy.gatewayOrigin())) return WEB_APP_PERMISSIONS.has(permission);
  if (isSettingsPageUrl(requestingUrl)) return SHELL_PAGE_PERMISSIONS.has(permission);
  return false;
}

/**
 * Electron security checklist, applied to every WebContents the app ever creates:
 * no new windows (web links open in the system browser), no navigation or redirect away from the page a
 * window belongs to, no <webview>, and permission requests denied unless explicitly listed above.
 */
export function installSecurityPolicy(policy: SecurityPolicy, log: Logger): void {
  const mayNavigate = (contents: WebContents, url: string): boolean => {
    const role = policy.roleOf(contents);
    if (role === 'web-app') return isGatewayUrl(url, policy.gatewayOrigin());
    if (role === 'settings') return isSettingsPageUrl(url);
    return false;
  };

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url, policy.gatewayOrigin())) {
        shell.openExternal(url).catch((error: unknown) => log('warn', `cannot open external link: ${String(error)}`));
      } else {
        log('warn', `blocked a new window for ${originForLog(url)}`);
      }
      return { action: 'deny' };
    });

    const block = (event: { preventDefault(): void; url: string }): void => {
      if (mayNavigate(contents, event.url)) return;
      event.preventDefault();
      log('warn', `blocked navigation to ${originForLog(event.url)}`);
    };
    contents.on('will-navigate', block);
    contents.on('will-frame-navigate', block);
    contents.on('will-redirect', block);
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  const defaultSession = session.defaultSession;
  defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(isAllowedPermission(permission, details.requestingUrl, policy));
  });
  defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    isAllowedPermission(permission, requestingOrigin, policy),
  );
  defaultSession.setDevicePermissionHandler(() => false);
  // No dictionary downloads from the network: the shell never loads remote content of its own.
  defaultSession.setSpellCheckerEnabled(false);
}
