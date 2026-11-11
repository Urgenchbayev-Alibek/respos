import http from 'node:http';
import https from 'node:https';

export type HealthCheckError = 'timeout' | 'unreachable' | 'certificate' | 'bad_status';

export type HealthCheckResult = { ok: true } | { ok: false; error: HealthCheckError; status?: number };

export const HEALTH_PATH = '/health/ready';
export const HEALTH_TIMEOUT_MS = 5_000;

const CERTIFICATE_ERRORS = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'CERT_REVOKED',
  'CERT_UNTRUSTED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'HOSTNAME_MISMATCH',
]);

function classify(error: unknown): HealthCheckError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'HEALTH_TIMEOUT') return 'timeout';
  return CERTIFICATE_ERRORS.has(code) ? 'certificate' : 'unreachable';
}

/**
 * Asks the backend's readiness probe (`GET <serverUrl>/health/ready`) with a hard deadline. Uses the same
 * Node HTTP stack — and therefore the same certificate validation — as the gateway's proxy.
 */
export function checkServerHealth(serverUrl: string, timeoutMs: number = HEALTH_TIMEOUT_MS): Promise<HealthCheckResult> {
  return new Promise<HealthCheckResult>((resolve) => {
    let url: URL;
    try {
      url = new URL(HEALTH_PATH, serverUrl);
    } catch {
      resolve({ ok: false, error: 'unreachable' });
      return;
    }
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'GET',
      agent: false,
      headers: { accept: 'text/plain, application/json' },
    });
    const timer = setTimeout(() => {
      request.destroy(Object.assign(new Error('health check timed out'), { code: 'HEALTH_TIMEOUT' }));
    }, timeoutMs);

    request.on('response', (response) => {
      clearTimeout(timer);
      const status = response.statusCode ?? 0;
      response.resume();
      resolve(status >= 200 && status < 300 ? { ok: true } : { ok: false, error: 'bad_status', status });
    });
    request.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: classify(error) });
    });
    request.end();
  });
}
