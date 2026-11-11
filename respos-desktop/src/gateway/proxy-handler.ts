import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import { buildDownstreamHeaders, buildUpstreamHeaders, pathForLog } from './headers';
import { SERVER_UNREACHABLE, sendProblem } from './problem';
import { type UpstreamTarget, upstreamRequest } from './target';

export interface ProxyTimeouts {
  /** TCP/TLS connect to the backend. */
  connectMs: number;
  /** From sending the request until the response headers arrive (covers SignalR long polling). */
  responseMs: number;
}

export type GatewayLogger = (level: 'info' | 'warn' | 'error', message: string) => void;

const RETRYABLE_SOCKET_ERRORS = new Set(['ECONNRESET', 'EPIPE']);

function hasRequestBody(req: IncomingMessage): boolean {
  if (req.headers['transfer-encoding'] !== undefined) return true;
  const length = Number(req.headers['content-length'] ?? 0);
  return Number.isFinite(length) && length > 0;
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return error instanceof Error ? error.message : 'unknown';
}

/**
 * Streams one request to the backend and the response back. Status and headers are kept (see `headers.ts` for
 * the few rewrites); nothing is buffered, so uploads, SSE and long polling behave as in a browser.
 * No answer from the backend (refused, DNS, TLS, timeout) → 502 ProblemDetails.
 */
export function proxyHttp(
  req: IncomingMessage,
  res: ServerResponse,
  target: UpstreamTarget,
  timeouts: ProxyTimeouts,
  log: GatewayLogger,
): void {
  const withBody = hasRequestBody(req);
  const headers = buildUpstreamHeaders(req.headers, target.hostHeader);
  let active: ClientRequest | null = null;
  let clientGone = false;

  res.on('close', () => {
    if (res.writableFinished) return;
    clientGone = true;
    active?.destroy();
  });
  req.on('error', () => active?.destroy());

  const fail = (error: unknown): void => {
    if (clientGone) return;
    if (res.headersSent) {
      // The response is already on its way: the only honest signal left is to cut the connection.
      res.destroy();
      return;
    }
    log('warn', `proxy ${req.method ?? 'GET'} ${pathForLog(req.url)} failed: ${errorCode(error)}`);
    // Let the rest of an upload drain so the renderer receives the 502 instead of a reset connection.
    if (active) req.unpipe(active);
    req.resume();
    sendProblem(res, SERVER_UNREACHABLE);
  };

  const attempt = (isRetry: boolean): void => {
    const upstreamReq = upstreamRequest(target, { method: req.method, path: req.url, headers });
    active = upstreamReq;

    const responseTimer = setTimeout(() => {
      upstreamReq.destroy(Object.assign(new Error('response timeout'), { code: 'GATEWAY_RESPONSE_TIMEOUT' }));
    }, timeouts.responseMs);

    upstreamReq.on('socket', (socket) => {
      if (!socket.connecting) return;
      const connectTimer = setTimeout(() => {
        upstreamReq.destroy(Object.assign(new Error('connect timeout'), { code: 'GATEWAY_CONNECT_TIMEOUT' }));
      }, timeouts.connectMs);
      const clear = (): void => clearTimeout(connectTimer);
      socket.once(target.secure ? 'secureConnect' : 'connect', clear);
      socket.once('close', clear);
    });

    upstreamReq.on('response', (upstreamRes) => {
      clearTimeout(responseTimer);
      res.writeHead(
        upstreamRes.statusCode ?? 502,
        upstreamRes.statusMessage,
        buildDownstreamHeaders(upstreamRes.rawHeaders, target.origin),
      );
      // Push the head out now: an SSE / long-polling response may not write a body chunk for a long time.
      res.flushHeaders();
      upstreamRes.on('error', () => res.destroy());
      upstreamRes.on('aborted', () => res.destroy());
      upstreamRes.pipe(res);
    });

    upstreamReq.on('error', (error) => {
      clearTimeout(responseTimer);
      if (active !== upstreamReq) return;
      // A pooled socket the backend closed while idle: safe to replay because no body has been sent.
      const staleSocket = upstreamReq.reusedSocket && RETRYABLE_SOCKET_ERRORS.has(errorCode(error));
      if (staleSocket && !withBody && !isRetry && !clientGone && !res.headersSent) {
        attempt(true);
        return;
      }
      fail(error);
    });

    if (withBody) req.pipe(upstreamReq);
    else upstreamReq.end();
  };

  attempt(false);
}
