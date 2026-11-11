import tls from 'node:tls';
import type { Logger } from './logger';

/**
 * The gateway proxies with Node's TLS stack, whose built-in CA bundle does not know certificates an
 * administrator installed into the Windows trust store (a restaurant chain's own CA). Adding the system store
 * makes an `https://` backend validate exactly like it does in a browser on the same PC. Validation itself is
 * never relaxed: there is no `rejectUnauthorized: false` anywhere in the shell.
 */
export function trustSystemCertificates(log: Logger): void {
  try {
    const system = tls.getCACertificates('system');
    if (system.length === 0) return;
    const merged = new Set([...tls.getCACertificates('default'), ...system]);
    tls.setDefaultCACertificates([...merged]);
    log('info', `trusting ${system.length} certificate authorities from the system store`);
  } catch (error) {
    log('warn', `system certificate store is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}
