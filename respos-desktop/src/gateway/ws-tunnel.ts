import type { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { buildDownstreamHeaders, buildUpstreamHeaders, pathForLog } from './headers';
import { SERVER_UNREACHABLE, writeRawProblem } from './problem';
import type { GatewayLogger } from './proxy-handler';
import { type UpstreamTarget, upstreamRequest } from './target';

function serializeHead(statusCode: number, statusMessage: string, rawHeaders: readonly string[]): Buffer {
  const lines = [`HTTP/1.1 ${statusCode} ${statusMessage}`];
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    lines.push(`${rawHeaders[index] ?? ''}: ${rawHeaders[index + 1] ?? ''}`);
  }
  return Buffer.from(`${lines.join('\r\n')}\r\n\r\n`, 'latin1');
}

/** Frames are small and latency-sensitive; an idle hub connection must not time out on our side. */
function tune(socket: Duplex): void {
  if (!(socket instanceof Socket)) return;
  socket.setNoDelay(true);
  socket.setTimeout(0);
}

/**
 * Tunnels a WebSocket upgrade (SignalR under `/hubs/*`) to the backend: the handshake is replayed there with
 * the same header rules as ordinary requests, then both sockets are piped into each other untouched.
 * `tunnels` tracks the open sockets so the gateway can drop them on retarget / shutdown.
 */
export function tunnelUpgrade(
  req: IncomingMessage,
  client: Duplex,
  head: Buffer,
  target: UpstreamTarget,
  handshakeTimeoutMs: number,
  tunnels: Set<Duplex>,
  log: GatewayLogger,
): void {
  const headers = buildUpstreamHeaders(req.headers, target.hostHeader);
  headers.connection = 'Upgrade';
  headers.upgrade = req.headers.upgrade ?? 'websocket';

  const upstreamReq = upstreamRequest(target, { method: 'GET', path: req.url, headers, dedicatedConnection: true });
  let settled = false;

  const timer = setTimeout(() => {
    upstreamReq.destroy(Object.assign(new Error('handshake timeout'), { code: 'GATEWAY_HANDSHAKE_TIMEOUT' }));
  }, handshakeTimeoutMs);

  const untrack = (socket: Duplex): void => {
    tunnels.delete(socket);
  };
  tunnels.add(client);
  client.on('close', () => {
    untrack(client);
    if (!settled) upstreamReq.destroy();
  });
  client.on('error', () => client.destroy());

  upstreamReq.on('upgrade', (upstreamRes, upstream, upstreamHead) => {
    settled = true;
    clearTimeout(timer);
    if (client.destroyed) {
      upstream.destroy();
      return;
    }
    tunnels.add(upstream);
    tune(client);
    tune(upstream);
    // The 101 head goes back verbatim: `Connection`, `Upgrade` and `Sec-WebSocket-Accept` are the handshake.
    client.write(serializeHead(upstreamRes.statusCode ?? 101, upstreamRes.statusMessage ?? 'Switching Protocols', upstreamRes.rawHeaders));
    if (upstreamHead.length > 0) client.write(upstreamHead);
    if (head.length > 0) upstream.write(head);

    upstream.on('error', () => upstream.destroy());
    upstream.on('close', () => {
      untrack(upstream);
      client.destroy();
    });
    client.on('close', () => upstream.destroy());
    upstream.pipe(client);
    client.pipe(upstream);
  });

  // The backend answered without switching protocols (401, 404, …): relay that answer and close.
  upstreamReq.on('response', (upstreamRes) => {
    settled = true;
    clearTimeout(timer);
    // Hop-by-hop headers (incl. Transfer-Encoding) are dropped; the body is de-chunked and ends with the socket.
    const relayed = [...buildDownstreamHeaders(upstreamRes.rawHeaders, target.origin), 'Connection', 'close'];
    client.write(serializeHead(upstreamRes.statusCode ?? 502, upstreamRes.statusMessage ?? '', relayed));
    upstreamRes.on('error', () => client.destroy());
    upstreamRes.pipe(client);
  });

  upstreamReq.on('error', (error) => {
    clearTimeout(timer);
    if (settled) {
      client.destroy();
      return;
    }
    settled = true;
    log('warn', `websocket ${pathForLog(req.url)} failed: ${error.message}`);
    writeRawProblem(client, SERVER_UNREACHABLE);
  });

  upstreamReq.end();
}
