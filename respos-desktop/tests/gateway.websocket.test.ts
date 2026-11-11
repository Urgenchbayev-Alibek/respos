import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import WebSocket, { type ClientOptions, type RawData } from 'ws';
import { LocalGateway } from '../src/gateway/local-gateway';
import { closedPort, type FakeUpstream, startFakeUpstream } from './helpers/fake-upstream';

let upstream: FakeUpstream;
let gateway: LocalGateway;
let port: number;
const sockets: WebSocket[] = [];

function connect(path: string, options: ClientOptions = {}): WebSocket {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`, options);
  sockets.push(socket);
  return socket;
}

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
}

/** Status of the HTTP answer when the upgrade is refused. */
function refusal(socket: WebSocket): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => reject(new Error('the upgrade unexpectedly succeeded')));
    socket.once('unexpected-response', (_request, response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    socket.once('error', reject);
  });
}

function nextMessage(socket: WebSocket): Promise<{ data: RawData; isBinary: boolean }> {
  return new Promise((resolve) => socket.once('message', (data, isBinary) => resolve({ data, isBinary })));
}

function text(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as ArrayBuffer).toString('utf8');
}

function closed(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => socket.once('close', () => resolve()));
}

beforeAll(async () => {
  upstream = await startFakeUpstream();
  gateway = new LocalGateway({ staticDir: null, preferredPort: 0, timeouts: { connectMs: 2_000, responseMs: 2_000 } });
  port = (await gateway.start()).port;
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.terminate();
  gateway.setTarget(upstream.origin);
  upstream.requests.length = 0;
});

afterAll(async () => {
  await gateway.stop();
  await upstream.close();
});

describe('gateway: WebSocket tunnel for /hubs', () => {
  it('tunnels text and binary frames in both directions', async () => {
    gateway.setTarget(upstream.origin);
    const socket = connect('/hubs/restaurant?access_token=jwt.abc&id=1');
    await opened(socket);

    const handshake = '{"protocol":"json","version":1}\u001e';
    const reply = nextMessage(socket);
    socket.send(handshake);
    const echoedText = await reply;
    expect(echoedText.isBinary).toBe(false);
    expect(text(echoedText.data)).toBe(handshake);

    const payload = Buffer.from(Array.from({ length: 70_000 }, (_, index) => index % 251));
    const binary = nextMessage(socket);
    socket.send(payload);
    const echoedBinary = await binary;
    expect(echoedBinary.isBinary).toBe(true);
    expect(Buffer.compare(echoedBinary.data as Buffer, payload)).toBe(0);
  });

  it('replays the handshake with the proxy header rules', async () => {
    const socket = connect('/hubs/restaurant?access_token=jwt.abc', {
      origin: `http://127.0.0.1:${port}`,
      headers: { cookie: 'device_token=xyz', referer: `http://127.0.0.1:${port}/kitchen` },
    });
    await opened(socket);

    const seen = upstream.requests.at(-1);
    expect(seen?.url).toBe('/hubs/restaurant?access_token=jwt.abc');
    expect(seen?.headers.host).toBe(`127.0.0.1:${upstream.port}`);
    expect(seen?.headers.upgrade).toBe('websocket');
    expect(seen?.headers.connection).toBe('Upgrade');
    expect(seen?.headers.cookie).toBe('device_token=xyz');
    expect(seen?.headers.origin).toBeUndefined();
    expect(seen?.headers.referer).toBeUndefined();
    expect(seen?.headers['sec-websocket-key']).toBeTruthy();
  });

  it('relays a non-101 answer of the backend and closes', async () => {
    const answer = await refusal(connect('/hubs/private'));
    expect(answer).toEqual({ status: 401, body: 'denied' });
  });

  it('refuses upgrades outside /hubs', async () => {
    const answer = await refusal(connect('/api/v1/socket'));
    expect(answer.status).toBe(404);
    expect(upstream.requests).toHaveLength(0);
  });

  it('refuses a foreign Origin (cross-site WebSocket hijacking) and a foreign Host', async () => {
    const foreignOrigin = await refusal(connect('/hubs/restaurant', { origin: 'https://evil.example' }));
    expect(foreignOrigin.status).toBe(403);
    expect(JSON.parse(foreignOrigin.body)).toMatchObject({ code: 'desktop.forbidden_origin' });

    const foreignHost = await refusal(connect('/hubs/restaurant', { headers: { host: 'evil.example' } }));
    expect(foreignHost.status).toBe(403);
    expect(JSON.parse(foreignHost.body)).toMatchObject({ code: 'desktop.forbidden_host' });
    expect(upstream.requests).toHaveLength(0);
  });

  it('answers 502 when the backend is unreachable or not configured', async () => {
    gateway.setTarget(`http://127.0.0.1:${await closedPort()}`);
    const unreachable = await refusal(connect('/hubs/restaurant'));
    expect(unreachable.status).toBe(502);
    expect(JSON.parse(unreachable.body)).toEqual({ status: 502, code: 'desktop.server_unreachable', title: 'Server unreachable' });

    gateway.setTarget(null);
    expect((await refusal(connect('/hubs/restaurant'))).status).toBe(502);
  });

  it('closes the client when the backend drops the connection', async () => {
    const socket = connect('/hubs/restaurant');
    await opened(socket);
    const closing = closed(socket);
    upstream.dropConnections();
    await expect(closing).resolves.toBeUndefined();
  });

  it('drops open tunnels on retarget so clients reconnect to the new backend', async () => {
    const socket = connect('/hubs/restaurant');
    await opened(socket);
    const closing = closed(socket);
    gateway.setTarget(upstream.origin);
    await expect(closing).resolves.toBeUndefined();

    const again = connect('/hubs/restaurant');
    await opened(again);
    const echo = nextMessage(again);
    again.send('ping');
    expect(text((await echo).data)).toBe('ping');
  });

  it('drops open tunnels when the gateway stops', async () => {
    const temporary = new LocalGateway({ staticDir: null, preferredPort: 0 });
    const temporaryPort = (await temporary.start()).port;
    temporary.setTarget(upstream.origin);
    const socket = new WebSocket(`ws://127.0.0.1:${temporaryPort}/hubs/restaurant`);
    sockets.push(socket);
    await opened(socket);
    const closing = closed(socket);
    await temporary.stop();
    await expect(closing).resolves.toBeUndefined();
  });
});
