import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { rewriteLocation, rewriteSetCookie } from '../src/gateway/headers';
import { LocalGateway } from '../src/gateway/local-gateway';
import { closedPort, type FakeUpstream, startFakeUpstream, STREAM_CHUNKS, STREAM_GAP_MS } from './helpers/fake-upstream';
import { headerValues, request } from './helpers/http-client';

const UNREACHABLE = { status: 502, code: 'desktop.server_unreachable', title: 'Server unreachable' };

let upstream: FakeUpstream;
let gateway: LocalGateway;
let port: number;

beforeAll(async () => {
  upstream = await startFakeUpstream();
  gateway = new LocalGateway({ staticDir: null, preferredPort: 0, timeouts: { connectMs: 2_000, responseMs: 600 } });
  port = (await gateway.start()).port;
});

afterEach(() => {
  gateway.setTarget(upstream.origin);
  upstream.requests.length = 0;
});

afterAll(async () => {
  await gateway.stop();
  await upstream.close();
});

describe('gateway: reverse proxy', () => {
  it('passes requests through with method, path, query and headers; Host becomes the backend host', async () => {
    gateway.setTarget(upstream.origin);
    const response = await request(port, {
      path: '/api/v1/echo?page=2&q=%D0%BF%D0%BB%D0%BE%D0%B2',
      headers: {
        authorization: 'Bearer token-123',
        'x-branch-id': '7f1c',
        cookie: 'refresh_token=abc; device_token=xyz',
        origin: `http://127.0.0.1:${port}`,
        referer: `http://127.0.0.1:${port}/kitchen`,
        'accept-language': 'ru',
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers['x-upstream']).toBe('fake');
    expect(headerValues(response, 'vary')).toEqual(['Origin', 'Accept']);

    const seen = JSON.parse(response.text) as { method: string; url: string; headers: Record<string, string> };
    expect(seen.method).toBe('GET');
    expect(seen.url).toBe('/api/v1/echo?page=2&q=%D0%BF%D0%BB%D0%BE%D0%B2');
    expect(seen.headers.host).toBe(`127.0.0.1:${upstream.port}`);
    expect(seen.headers.authorization).toBe('Bearer token-123');
    expect(seen.headers['x-branch-id']).toBe('7f1c');
    expect(seen.headers.cookie).toBe('refresh_token=abc; device_token=xyz');
    expect(seen.headers['accept-language']).toBe('ru');
    expect(seen.headers.origin).toBeUndefined();
    expect(seen.headers.referer).toBeUndefined();
  });

  it('keeps the backend status and body', async () => {
    const response = await request(port, { path: '/api/v1/missing' });
    expect(response.status).toBe(404);
    expect(JSON.parse(response.text)).toEqual({ status: 404, code: 'common.not_found', title: 'Not found' });
  });

  it('proxies every backend prefix: /api, /hubs (HTTP), /files, /health', async () => {
    const photo = await request(port, { path: '/files/photo.png' });
    expect(photo.status).toBe(200);
    expect(photo.headers['content-type']).toBe('image/png');
    expect([...photo.body]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);

    expect((await request(port, { path: '/health/ready' })).text).toBe('Healthy');
    const negotiate = await request(port, { method: 'POST', path: '/hubs/restaurant/negotiate?negotiateVersion=1' });
    expect(JSON.parse(negotiate.text)).toMatchObject({ connectionId: 'c1' });
  });

  it('does not proxy paths that merely start with the same letters', async () => {
    const response = await request(port, { path: '/apiary' });
    expect(response.text).toContain('desktop-placeholder');
    expect(upstream.requests).toHaveLength(0);
  });

  it('streams a large request body (photo upload) unchanged', async () => {
    const body = randomBytes(3 * 1024 * 1024);
    const response = await request(port, {
      method: 'POST',
      path: '/api/v1/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': body.length },
      body,
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.text)).toEqual({
      length: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
    });
  });

  it('streams a chunked request body of unknown length', async () => {
    const parts = [randomBytes(70_000), randomBytes(1), randomBytes(130_000)];
    const result = await new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port, method: 'POST', path: '/api/v1/upload', agent: false },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
        },
      );
      req.on('error', reject);
      for (const part of parts) req.write(part);
      req.end();
    });
    expect(result.status).toBe(201);
    expect(JSON.parse(result.text)).toEqual({
      length: 200_001,
      sha256: createHash('sha256').update(Buffer.concat(parts)).digest('hex'),
    });
    expect(upstream.requests.at(-1)?.headers['transfer-encoding']).toBe('chunked');
  });

  it('streams the response as it is produced (SSE / long polling), without buffering', async () => {
    const result = await new Promise<{ firstChunkAt: number; endedAt: number; text: string; events: number }>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/api/v1/stream', agent: false }, (res) => {
        let firstChunkAt = 0;
        let events = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          if (firstChunkAt === 0) firstChunkAt = Date.now();
          events += 1;
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ firstChunkAt, endedAt: Date.now(), text: Buffer.concat(chunks).toString('utf8'), events }));
      });
      req.on('error', reject);
      req.end();
    });
    expect(result.text).toBe(STREAM_CHUNKS.join(''));
    expect(result.events).toBeGreaterThanOrEqual(2);
    // The first event reached the client long before the backend finished writing the last one.
    expect(result.endedAt - result.firstChunkAt).toBeGreaterThanOrEqual(STREAM_GAP_MS);
  });

  it('delivers the response head before any body exists and aborts the backend request when the client leaves', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/api/v1/stream?hold=1', agent: false }, (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        res.once('data', () => {
          req.destroy();
          resolve();
        });
      });
      req.on('error', reject);
      req.end();
    });
    await expect(upstream.streamClosed()).resolves.toBeUndefined();
  });

  it('rewrites Set-Cookie for the plain-http loopback hop and keeps every cookie', async () => {
    const response = await request(port, { method: 'POST', path: '/api/v1/auth/login', body: '{}' });
    expect(response.status).toBe(200);
    expect(headerValues(response, 'set-cookie')).toEqual([
      'refresh_token=abc.def; Max-Age=1209600; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
      'device_token=xyz; Expires=Wed, 01 Jan 2031 00:00:00 GMT; Path=/api/v1; HttpOnly; SameSite=Lax',
    ]);
  });

  it('keeps redirects to the backend origin inside the gateway origin', async () => {
    const response = await request(port, { path: '/api/v1/redirect' });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/api/v1/echo?from=redirect');
  });

  it('survives a pooled connection the backend closed while idle', async () => {
    expect((await request(port, { path: '/api/v1/echo' })).status).toBe(200);
    upstream.dropConnections();
    expect((await request(port, { path: '/api/v1/echo' })).status).toBe(200);
  });

  it('switches to another backend on retarget', async () => {
    const other = await startFakeUpstream();
    try {
      gateway.setTarget(other.origin);
      expect(gateway.targetOrigin).toBe(other.origin);
      const seen = JSON.parse((await request(port, { path: '/api/v1/echo' })).text) as { headers: Record<string, string> };
      expect(seen.headers.host).toBe(`127.0.0.1:${other.port}`);
      expect(upstream.requests).toHaveLength(0);
    } finally {
      await other.close();
    }
  });
});

describe('gateway: backend unreachable', () => {
  it('answers 502 ProblemDetails when nothing listens on the backend address', async () => {
    gateway.setTarget(`http://127.0.0.1:${await closedPort()}`);
    const response = await request(port, { path: '/api/v1/echo' });
    expect(response.status).toBe(502);
    expect(response.headers['content-type']).toBe('application/problem+json; charset=utf-8');
    expect(JSON.parse(response.text)).toEqual(UNREACHABLE);
  });

  it('answers 502 to an upload as well (the body is drained, the connection is not reset)', async () => {
    gateway.setTarget(`http://127.0.0.1:${await closedPort()}`);
    const response = await request(port, { method: 'POST', path: '/api/v1/upload', body: randomBytes(512 * 1024) });
    expect(response.status).toBe(502);
    expect(JSON.parse(response.text)).toEqual(UNREACHABLE);
  });

  it('answers 502 when the backend host cannot be resolved', async () => {
    gateway.setTarget('http://backend.invalid:5080');
    const response = await request(port, { path: '/health/ready' });
    expect(response.status).toBe(502);
    expect(JSON.parse(response.text)).toEqual(UNREACHABLE);
  });

  it('answers 502 when the backend does not respond in time', async () => {
    const startedAt = Date.now();
    const response = await request(port, { path: '/api/v1/slow' });
    expect(response.status).toBe(502);
    expect(JSON.parse(response.text)).toEqual(UNREACHABLE);
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });

  it('answers 502 while no backend is configured (first run)', async () => {
    gateway.setTarget(null);
    expect(gateway.targetOrigin).toBeNull();
    const response = await request(port, { method: 'POST', path: '/api/v1/auth/refresh', body: '{}' });
    expect(response.status).toBe(502);
    expect(JSON.parse(response.text)).toEqual(UNREACHABLE);
  });
});

describe('header rewrites', () => {
  it('drops Secure, Domain, SameSite and Partitioned from cookies in any letter case', () => {
    expect(rewriteSetCookie('a=b; secure; DOMAIN=.x.uz; samesite=none; httponly; path=/')).toBe('a=b; httponly; path=/; SameSite=Lax');
    expect(rewriteSetCookie('a=b')).toBe('a=b; SameSite=Lax');
    expect(rewriteSetCookie('token=a=b==; Secure')).toBe('token=a=b==; SameSite=Lax');
  });

  it('rewrites only Location values that point at the backend origin', () => {
    const origin = 'http://10.0.0.5:5080';
    expect(rewriteLocation('http://10.0.0.5:5080/api/v1/x?y=1', origin)).toBe('/api/v1/x?y=1');
    expect(rewriteLocation('http://10.0.0.5:5080', origin)).toBe('/');
    expect(rewriteLocation('http://10.0.0.5:5080?y=1', origin)).toBe('/?y=1');
    expect(rewriteLocation('http://10.0.0.5:50801/x', origin)).toBe('http://10.0.0.5:50801/x');
    expect(rewriteLocation('https://pay.example.uz/checkout', origin)).toBe('https://pay.example.uz/checkout');
    expect(rewriteLocation('/relative', origin)).toBe('/relative');
  });
});
