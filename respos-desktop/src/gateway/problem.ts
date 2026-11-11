import type { ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';

/** ProblemDetails subset the web app understands (`code` is mapped to a localized message, `title` is the fallback). */
export interface GatewayProblem {
  readonly status: number;
  readonly code: string;
  readonly title: string;
}

export const SERVER_UNREACHABLE: GatewayProblem = Object.freeze({
  status: 502,
  code: 'desktop.server_unreachable',
  title: 'Server unreachable',
});

export const FORBIDDEN_HOST: GatewayProblem = Object.freeze({
  status: 403,
  code: 'desktop.forbidden_host',
  title: 'Forbidden host',
});

export const FORBIDDEN_ORIGIN: GatewayProblem = Object.freeze({
  status: 403,
  code: 'desktop.forbidden_origin',
  title: 'Forbidden origin',
});

export const BAD_REQUEST: GatewayProblem = Object.freeze({
  status: 400,
  code: 'desktop.bad_request',
  title: 'Bad request',
});

export const NOT_FOUND: GatewayProblem = Object.freeze({
  status: 404,
  code: 'desktop.not_found',
  title: 'Not found',
});

export const METHOD_NOT_ALLOWED: GatewayProblem = Object.freeze({
  status: 405,
  code: 'desktop.method_not_allowed',
  title: 'Method not allowed',
});

const REASON_PHRASES: Readonly<Record<number, string>> = Object.freeze({
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  502: 'Bad Gateway',
});

const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

function problemBody(problem: GatewayProblem): Buffer {
  return Buffer.from(JSON.stringify({ status: problem.status, code: problem.code, title: problem.title }), 'utf8');
}

/** Answers a normal HTTP request with a ProblemDetails body. No-op when the response has already started. */
export function sendProblem(res: ServerResponse, problem: GatewayProblem, extraHeaders: Record<string, string> = {}): void {
  if (res.headersSent || res.destroyed) return;
  const body = problemBody(problem);
  res.writeHead(problem.status, {
    'Content-Type': PROBLEM_CONTENT_TYPE,
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(body);
}

/** Answers on a raw socket (failed WebSocket upgrade) and closes it. */
export function writeRawProblem(socket: Duplex, problem: GatewayProblem): void {
  if (socket.destroyed || !socket.writable) {
    socket.destroy();
    return;
  }
  const body = problemBody(problem);
  const head = [
    `HTTP/1.1 ${problem.status} ${REASON_PHRASES[problem.status] ?? 'Error'}`,
    `Content-Type: ${PROBLEM_CONTENT_TYPE}`,
    `Content-Length: ${body.length}`,
    'Cache-Control: no-store',
    'Connection: close',
    '',
    '',
  ].join('\r\n');
  socket.end(Buffer.concat([Buffer.from(head, 'latin1'), body]));
}
