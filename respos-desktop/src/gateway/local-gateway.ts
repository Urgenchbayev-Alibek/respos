import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { isAllowedHost, isAllowedOrigin } from './headers';
import { isBrowserSafePort } from './ports';
import {
  BAD_REQUEST,
  FORBIDDEN_HOST,
  FORBIDDEN_ORIGIN,
  type GatewayProblem,
  NOT_FOUND,
  SERVER_UNREACHABLE,
  sendProblem,
  writeRawProblem,
} from './problem';
import { type GatewayLogger, proxyHttp, type ProxyTimeouts } from './proxy-handler';
import { serveStatic } from './static-handler';
import { createTarget, type UpstreamTarget } from './target';
import { tunnelUpgrade } from './ws-tunnel';

export const GATEWAY_HOST = '127.0.0.1';
/** Fixed port → stable origin → the web app keeps its localStorage (theme, branch, device settings). */
export const PREFERRED_GATEWAY_PORT = 47615;

/** Path prefixes that belong to the backend; everything else is the bundled web app. */
const PROXIED_PREFIXES = ['/api', '/hubs', '/files', '/health'] as const;
const WEBSOCKET_PREFIX = '/hubs';

const DEFAULT_TIMEOUTS: ProxyTimeouts = { connectMs: 10_000, responseMs: 120_000 };
const FREE_PORT_ATTEMPTS = 20;

export interface GatewayOptions {
  /** Folder with the built web app; `null` → built-in placeholder page. */
  staticDir: string | null;
  /** Port to try first; `0` picks a free one. Defaults to PREFERRED_GATEWAY_PORT. */
  preferredPort?: number;
  timeouts?: Partial<ProxyTimeouts>;
  logger?: GatewayLogger;
}

export interface GatewayStartInfo {
  port: number;
  origin: string;
  /** The preferred port was taken and a random free port is used instead. */
  usedFallbackPort: boolean;
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function pathnameOf(url: string | undefined): string | null {
  // Only origin-form targets are served; absolute-form (`GET http://other/`) and `*` are refused.
  if (url === undefined || !url.startsWith('/')) return null;
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

/**
 * Loopback HTTP server that makes the bundled web app and the backend API one origin for the renderer:
 * static files + SPA fallback, and a streaming reverse proxy (HTTP and WebSocket) to the configured backend.
 */
export class LocalGateway {
  private readonly staticDir: string | null;
  private readonly preferredPort: number;
  private readonly timeouts: ProxyTimeouts;
  private readonly log: GatewayLogger;
  private readonly tunnels = new Set<Duplex>();
  private server: http.Server | null = null;
  private target: UpstreamTarget | null = null;
  private listeningPort = 0;

  constructor(options: GatewayOptions) {
    this.staticDir = options.staticDir;
    this.preferredPort = options.preferredPort ?? PREFERRED_GATEWAY_PORT;
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts };
    this.log = options.logger ?? (() => undefined);
  }

  /** `http://127.0.0.1:<port>` — the only origin the main window may show. */
  get origin(): string {
    return `http://${GATEWAY_HOST}:${this.listeningPort}`;
  }

  get targetOrigin(): string | null {
    return this.target?.origin ?? null;
  }

  async start(): Promise<GatewayStartInfo> {
    if (this.server) throw new Error('Gateway is already running');
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((error: unknown) => {
        this.log('error', `request failed: ${error instanceof Error ? error.message : String(error)}`);
        if (res.headersSent) res.destroy();
        else sendProblem(res, BAD_REQUEST);
      });
    });
    server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket, head));
    server.on('clientError', (_error, socket) => {
      if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      else socket.destroy();
    });

    let usedFallbackPort = false;
    if (this.preferredPort === 0) {
      await listenOnFreePort(server);
    } else {
      try {
        if (!isBrowserSafePort(this.preferredPort)) throw new Error('port is blocked by the browser');
        await listen(server, this.preferredPort);
      } catch {
        this.log('warn', `port ${this.preferredPort} is unavailable, using a random free port`);
        usedFallbackPort = true;
        await listenOnFreePort(server);
      }
    }
    this.server = server;
    this.listeningPort = (server.address() as AddressInfo).port;
    return { port: this.listeningPort, origin: this.origin, usedFallbackPort };
  }

  /** Points the proxy at another backend (or at none). Open WebSocket tunnels are dropped so clients reconnect. */
  setTarget(serverUrl: string | null): void {
    const previous = this.target;
    this.target = serverUrl === null ? null : createTarget(serverUrl);
    previous?.agent.destroy();
    this.closeTunnels();
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.closeTunnels();
    this.target?.agent.destroy();
    this.target = null;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    this.listeningPort = 0;
  }

  private closeTunnels(): void {
    for (const socket of this.tunnels) socket.destroy();
    this.tunnels.clear();
  }

  private guard(req: IncomingMessage): GatewayProblem | null {
    if (!isAllowedHost(req.headers.host, this.listeningPort)) return FORBIDDEN_HOST;
    if (!isAllowedOrigin(req.headers.origin, this.listeningPort)) return FORBIDDEN_ORIGIN;
    return null;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const refusal = this.guard(req);
    if (refusal) {
      sendProblem(res, refusal);
      return;
    }
    const pathname = pathnameOf(req.url);
    if (pathname === null) {
      sendProblem(res, BAD_REQUEST);
      return;
    }
    if (PROXIED_PREFIXES.some((prefix) => isUnder(pathname, prefix))) {
      if (!this.target) {
        req.resume();
        sendProblem(res, SERVER_UNREACHABLE);
        return;
      }
      proxyHttp(req, res, this.target, this.timeouts, this.log);
      return;
    }
    await serveStatic(req, res, pathname, { rootDir: this.staticDir, port: this.listeningPort });
  }

  private handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    socket.on('error', () => socket.destroy());
    const refusal = this.guard(req);
    if (refusal) {
      writeRawProblem(socket, refusal);
      return;
    }
    const pathname = pathnameOf(req.url);
    const isWebSocket = (req.headers.upgrade ?? '').toLowerCase() === 'websocket';
    if (pathname === null || !isWebSocket || !isUnder(pathname, WEBSOCKET_PREFIX)) {
      writeRawProblem(socket, NOT_FOUND);
      return;
    }
    if (!this.target) {
      writeRawProblem(socket, SERVER_UNREACHABLE);
      return;
    }
    tunnelUpgrade(req, socket, head, this.target, this.timeouts.connectMs, this.tunnels, this.log);
  }
}

/** Any free port the renderer may actually load from (see ports.ts). */
async function listenOnFreePort(server: http.Server): Promise<void> {
  for (let attempt = 0; attempt < FREE_PORT_ATTEMPTS; attempt += 1) {
    await listen(server, 0);
    if (isBrowserSafePort((server.address() as AddressInfo).port)) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  throw new Error('No usable free port for the local gateway');
}

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, GATEWAY_HOST);
  });
}
