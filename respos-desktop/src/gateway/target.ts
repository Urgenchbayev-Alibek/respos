import http from 'node:http';
import https from 'node:https';

/** Idle keep-alive sockets are dropped well before common server keep-alive timeouts (Kestrel 130 s, nginx 75 s). */
const IDLE_SOCKET_TIMEOUT_MS = 30_000;

/** The backend the gateway currently proxies to. */
export interface UpstreamTarget {
  /** `http://192.168.1.10:5080` */
  readonly origin: string;
  readonly secure: boolean;
  /** Host name without IPv6 brackets, as `http.request` expects it. */
  readonly hostname: string;
  readonly port: number;
  /** Value of the `Host` header toward the backend (`host[:port]`). */
  readonly hostHeader: string;
  /** Keep-alive pool for ordinary requests. Certificates are validated with Node's defaults. */
  readonly agent: http.Agent | https.Agent;
}

/** Builds a target from an already normalized origin (see `normalizeServerUrl`). Throws on anything else. */
export function createTarget(serverUrl: string): UpstreamTarget {
  const parsed = new URL(serverUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported backend protocol: ${parsed.protocol}`);
  }
  const secure = parsed.protocol === 'https:';
  const agentOptions = { keepAlive: true, timeout: IDLE_SOCKET_TIMEOUT_MS, maxFreeSockets: 16 };
  return {
    origin: parsed.origin,
    secure,
    hostname: parsed.hostname.replace(/^\[|\]$/g, ''),
    port: parsed.port === '' ? (secure ? 443 : 80) : Number(parsed.port),
    hostHeader: parsed.host,
    agent: secure ? new https.Agent(agentOptions) : new http.Agent(agentOptions),
  };
}

/** `http.request` / `https.request` for the target; `agent: false` opens a dedicated connection. */
export function upstreamRequest(
  target: UpstreamTarget,
  options: Pick<http.RequestOptions, 'method' | 'path' | 'headers'> & { dedicatedConnection?: boolean },
): http.ClientRequest {
  const requestOptions: http.RequestOptions = {
    host: target.hostname,
    port: target.port,
    method: options.method,
    path: options.path,
    headers: options.headers,
    agent: options.dedicatedConnection ? false : target.agent,
    setHost: false,
  };
  return target.secure ? https.request(requestOptions) : http.request(requestOptions);
}
