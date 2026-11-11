import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkServerHealth } from '../src/gateway/health-check';
import { closedPort, type FakeUpstream, startFakeUpstream } from './helpers/fake-upstream';

let upstream: FakeUpstream;

beforeAll(async () => {
  upstream = await startFakeUpstream();
});

afterAll(async () => {
  await upstream.close();
});

describe('server health check', () => {
  it('is ok when /health/ready answers 2xx', async () => {
    expect(await checkServerHealth(upstream.origin)).toEqual({ ok: true });
    expect(upstream.requests.at(-1)).toMatchObject({ method: 'GET', url: '/health/ready' });
  });

  it('reports a non-2xx status', async () => {
    const unhealthy = http.createServer((_req, res) => {
      res.writeHead(503);
      res.end('Unhealthy');
    });
    await new Promise<void>((resolve) => unhealthy.listen(0, '127.0.0.1', resolve));
    try {
      const port = (unhealthy.address() as AddressInfo).port;
      expect(await checkServerHealth(`http://127.0.0.1:${port}`)).toEqual({ ok: false, error: 'bad_status', status: 503 });
    } finally {
      await new Promise<void>((resolve) => unhealthy.close(() => resolve()));
    }
  });

  it('reports an unreachable server', async () => {
    expect(await checkServerHealth(`http://127.0.0.1:${await closedPort()}`)).toEqual({ ok: false, error: 'unreachable' });
    expect(await checkServerHealth('http://backend.invalid:5080')).toEqual({ ok: false, error: 'unreachable' });
  });

  it('gives up after the deadline', async () => {
    const silent = http.createServer(() => undefined);
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    try {
      const port = (silent.address() as AddressInfo).port;
      const startedAt = Date.now();
      expect(await checkServerHealth(`http://127.0.0.1:${port}`, 300)).toEqual({ ok: false, error: 'timeout' });
      expect(Date.now() - startedAt).toBeLessThan(3_000);
    } finally {
      silent.closeAllConnections();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    }
  });
});
