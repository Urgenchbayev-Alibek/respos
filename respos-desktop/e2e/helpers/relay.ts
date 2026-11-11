import net, { type AddressInfo } from 'node:net';

export interface BackendRelay {
  /** `http://127.0.0.1:<port>` — the address the app is given instead of the real backend. */
  readonly origin: string;
  readonly port: number;
  /** "The server went down": stops listening and cuts every open connection (HTTP and WebSocket). */
  stop(): Promise<void>;
  /** "The server is back": listens again on the same port. */
  start(): Promise<void>;
}

/**
 * A TCP relay in front of the real backend. End-to-end tests point the app at the relay, so a test can take
 * "the server" away and bring it back without touching the backend other tests are using.
 */
export async function startBackendRelay(backendUrl: string): Promise<BackendRelay> {
  const backend = new URL(backendUrl);
  if (backend.protocol !== 'http:') throw new Error(`The relay forwards plain http only, got ${backend.protocol}`);
  const backendPort = backend.port === '' ? 80 : Number(backend.port);
  const backendHost = backend.hostname.replace(/^\[|\]$/g, '');

  const sockets = new Set<net.Socket>();
  let server: net.Server | null = null;
  let port = 0;

  const track = (socket: net.Socket): void => {
    sockets.add(socket);
    socket.on('error', () => socket.destroy());
    socket.on('close', () => sockets.delete(socket));
  };

  const start = async (): Promise<void> => {
    if (server) return;
    const next = net.createServer((client) => {
      const upstream = net.connect(backendPort, backendHost);
      track(client);
      track(upstream);
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => client.destroy());
      client.pipe(upstream);
      upstream.pipe(client);
    });
    await new Promise<void>((resolve, reject) => {
      next.once('error', reject);
      next.listen(port, '127.0.0.1', resolve);
    });
    server = next;
    port = (next.address() as AddressInfo).port;
  };

  const stop = async (): Promise<void> => {
    const current = server;
    server = null;
    if (!current) return;
    await new Promise<void>((resolve) => {
      current.close(() => resolve());
      for (const socket of sockets) socket.destroy();
    });
  };

  await start();
  return {
    get origin() {
      return `http://127.0.0.1:${port}`;
    },
    get port() {
      return port;
    },
    stop,
    start,
  };
}
