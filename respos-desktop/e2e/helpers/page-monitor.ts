import type { Page } from 'playwright';

export interface PageMonitor {
  /** `console.error` output and uncaught exceptions of the page (CSP violations are reported here too). */
  readonly errors: string[];
  /** Requests that got no response at all, and responses with a 4xx / 5xx status. */
  readonly failedRequests: string[];
  /** URLs of the WebSockets the page opened that received at least one frame. */
  readonly liveWebSockets: string[];
  /** Forgets everything recorded so far. */
  reset(): void;
  /** Stops recording. */
  stop(): void;
}

const ACCESS_TOKEN = /access_token=[^&]+/;

/** A request the page gave up on by itself (navigation, an unmounted component) is not a failure. */
function isAbort(errorText: string | undefined): boolean {
  return errorText === 'net::ERR_ABORTED';
}

/** Records what would tell a user (or a developer) that something is broken on the page. */
export function monitorPage(page: Page): PageMonitor {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  const liveWebSockets: string[] = [];

  const onConsole = (message: { type(): string; text(): string }): void => {
    if (message.type() === 'error') errors.push(message.text());
  };
  const onPageError = (error: Error): void => {
    errors.push(`uncaught: ${error.message}`);
  };
  const onRequestFailed = (request: { method(): string; url(): string; failure(): { errorText: string } | null }): void => {
    const reason = request.failure()?.errorText;
    if (!isAbort(reason)) failedRequests.push(`${request.method()} ${request.url()} — ${reason ?? 'failed'}`);
  };
  const onResponse = (response: { status(): number; url(): string; request(): { method(): string } }): void => {
    if (response.status() >= 400) failedRequests.push(`${response.request().method()} ${response.url()} — ${response.status()}`);
  };
  const onWebSocket = (socket: { url(): string; once(event: 'framereceived', listener: () => void): void }): void => {
    // The access token travels in the query string of the hub URL: it must not end up in a test report.
    socket.once('framereceived', () => liveWebSockets.push(socket.url().replace(ACCESS_TOKEN, 'access_token=…')));
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  page.on('websocket', onWebSocket);

  return {
    errors,
    failedRequests,
    liveWebSockets,
    reset: () => {
      errors.length = 0;
      failedRequests.length = 0;
      liveWebSockets.length = 0;
    },
    stop: () => {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
      page.off('websocket', onWebSocket);
    },
  };
}
