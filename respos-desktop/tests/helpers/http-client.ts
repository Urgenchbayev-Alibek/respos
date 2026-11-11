import http, { type IncomingHttpHeaders, type OutgoingHttpHeaders } from 'node:http';

export interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  /** name, value, name, value … exactly as received. */
  rawHeaders: string[];
  body: Buffer;
  text: string;
}

export interface RawRequest {
  method?: string;
  path: string;
  headers?: OutgoingHttpHeaders;
  body?: Buffer | string;
}

/**
 * One request to the gateway on 127.0.0.1 with full control over the headers (a browser-like `Host` is sent by
 * default; tests override it to check the guards). No redirects are followed, nothing is decoded.
 */
export function request(port: number, options: RawRequest): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: options.method ?? 'GET',
        path: options.path,
        headers: { host: `127.0.0.1:${port}`, ...options.headers },
        agent: false,
        setHost: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            rawHeaders: res.rawHeaders,
            body,
            text: body.toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.end(options.body);
  });
}

/** All values of one response header, in order (for repeated headers such as Set-Cookie). */
export function headerValues(response: RawResponse, name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index + 1 < response.rawHeaders.length; index += 2) {
    if (response.rawHeaders[index]?.toLowerCase() === name.toLowerCase()) values.push(response.rawHeaders[index + 1] ?? '');
  }
  return values;
}
