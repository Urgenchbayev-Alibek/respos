import { createHash } from 'node:crypto';
import http, { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';

export interface SeenRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
}

export interface FakeUpstream {
  origin: string;
  port: number;
  /** Every HTTP request and WebSocket handshake the fake backend received, oldest first. */
  requests: SeenRequest[];
  /** Resolves when the client of the streaming endpoint has gone away. */
  streamClosed(): Promise<void>;
  /** Drops every open connection (HTTP keep-alive and WebSocket) without stopping the server. */
  dropConnections(): void;
  close(): Promise<void>;
}

export const STREAM_CHUNKS = ['data: one\n\n', 'data: two\n\n', 'data: three\n\n'];
export const STREAM_GAP_MS = 150;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string | string[]> = {}): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

/**
 * A stand-in for the RestaurantOS backend: enough HTTP behaviour to exercise every proxy rule
 * (echo, upload, cookies, redirect, streaming, a response that never comes) plus a WebSocket echo hub.
 */
export async function startFakeUpstream(listenPort = 0): Promise<FakeUpstream> {
  const requests: SeenRequest[] = [];
  let resolveStreamClosed: () => void = () => undefined;
  const streamClosed = new Promise<void>((resolve) => {
    resolveStreamClosed = resolve;
  });

  const server = http.createServer((req, res) => {
    const seen = { method: req.method ?? '', url: req.url ?? '', headers: req.headers };
    requests.push(seen);
    const { pathname } = new URL(seen.url, 'http://upstream.test');

    const handle = async (): Promise<void> => {
      if (pathname === '/health/ready') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Healthy');
      } else if (pathname === '/health/down') {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Unhealthy');
      } else if (pathname === '/api/v1/echo') {
        const body = await readBody(req);
        json(res, 200, { ...seen, bodyLength: body.length }, { 'X-Upstream': 'fake', Vary: ['Origin', 'Accept'] });
      } else if (pathname === '/api/v1/upload') {
        const body = await readBody(req);
        json(res, 201, { length: body.length, sha256: createHash('sha256').update(body).digest('hex') });
      } else if (pathname === '/api/v1/auth/login') {
        await readBody(req);
        json(res, 200, { accessToken: 'test-access-token' }, {
          'Set-Cookie': [
            'refresh_token=abc.def; Max-Age=1209600; Domain=api.example.uz; Path=/api/v1/auth; Secure; HttpOnly; SameSite=None',
            'device_token=xyz; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/api/v1; Secure; HttpOnly; SameSite=Strict; Partitioned',
          ],
        });
      } else if (pathname === '/api/v1/redirect') {
        res.writeHead(302, { Location: `http://${req.headers.host ?? ''}/api/v1/echo?from=redirect` });
        res.end();
      } else if (pathname === '/api/v1/missing') {
        json(res, 404, { status: 404, code: 'common.not_found', title: 'Not found' });
      } else if (pathname === '/api/v1/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        res.flushHeaders();
        res.on('close', resolveStreamClosed);
        for (const chunk of STREAM_CHUNKS) {
          if (res.destroyed) return;
          res.write(chunk);
          await new Promise((resolve) => setTimeout(resolve, STREAM_GAP_MS));
        }
        if (new URL(seen.url, 'http://upstream.test').searchParams.get('hold') !== '1') res.end();
      } else if (pathname === '/api/v1/slow') {
        // Never answers: the gateway's response timeout has to end this request.
      } else if (pathname === '/files/photo.png') {
        const body = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': body.length });
        res.end(body);
      } else if (pathname === '/hubs/restaurant/negotiate') {
        await readBody(req);
        json(res, 200, { connectionId: 'c1', availableTransports: [{ transport: 'WebSockets' }] });
      } else {
        json(res, 404, { status: 404, code: 'fake.unknown_path', title: 'Unknown path' });
      }
    };
    handle().catch(() => res.destroy());
  });

  // Echo hub under /hubs/restaurant; any other upgrade is answered with a plain 401 (non-101 path).
  const hub = new WebSocketServer({ noServer: true });
  hub.on('connection', (socket) => {
    socket.on('message', (data, isBinary) => socket.send(data, { binary: isBinary }));
  });
  server.on('upgrade', (req, socket, head) => {
    requests.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers });
    const { pathname } = new URL(req.url ?? '/', 'http://upstream.test');
    if (pathname === '/hubs/restaurant') {
      hub.handleUpgrade(req, socket, head, (client) => hub.emit('connection', client, req));
    } else {
      socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nContent-Length: 6\r\nConnection: close\r\n\r\ndenied');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(listenPort, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;

  const dropConnections = (): void => {
    for (const client of hub.clients) client.terminate();
    server.closeAllConnections();
  };

  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    requests,
    streamClosed: () => streamClosed,
    dropConnections,
    close: () =>
      new Promise<void>((resolve) => {
        dropConnections();
        server.close(() => resolve());
      }),
  };
}

/** A port on which nothing listens (reserved, then released). */
export async function closedPort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
