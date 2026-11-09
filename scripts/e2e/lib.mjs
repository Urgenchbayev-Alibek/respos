// Shared helpers for the e2e smoke scenario: timed REST client, step runner, SignalR listener.
import * as signalR from '@microsoft/signalr';

export const API = (process.env.E2E_API_URL ?? 'http://localhost:5080/api/v1').replace(/\/$/, '');
export const ORIGIN = new URL(API).origin;
export const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'Demo123!';

/** Every REST call's latency (ms), keyed by "METHOD /path-template". */
export const latencies = [];
const results = [];

export class StepError extends Error {}

export function check(condition, message) {
  if (!condition) throw new StepError(message);
}

export function eq(actual, expected, message) {
  if (actual !== expected) throw new StepError(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

export function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function qty(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

/** Runs a named step; prints ✔/✘ and records the outcome. Aborts the scenario on failure unless `soft`. */
export async function step(name, fn, { soft = false } = {}) {
  const started = performance.now();
  try {
    const detail = await fn();
    const ms = Math.round(performance.now() - started);
    results.push({ name, ok: true, ms });
    console.log(`✔ ${name}${detail ? ` — ${detail}` : ''} (${ms} ms)`);
    return true;
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`✘ ${name} — ${error.message}`);
    if (!soft) throw new StepError(`aborted at: ${name}`);
    return false;
  }
}

export function summary() {
  const failed = results.filter((r) => !r.ok);
  return { total: results.length, failed: failed.length, results };
}

function template(path) {
  return path.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}');
}

/** A REST client bound to one user's token and (optionally) a branch. */
export class Client {
  constructor(label, token = null, branchId = null) {
    this.label = label;
    this.token = token;
    this.branchId = branchId;
  }

  async request(method, path, { body, headers = {}, expect } = {}) {
    const h = { Accept: 'application/json', ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    if (this.branchId) h['X-Branch-Id'] = this.branchId;
    const started = performance.now();
    const res = await fetch(API + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    const ms = performance.now() - started;
    latencies.push({ key: `${method} ${template(path)}`, ms });
    let json = null;
    if (text) {
      try { json = JSON.parse(text); } catch { json = text; }
    }
    const out = { status: res.status, json, headers: res.headers, ms };
    if (expect !== undefined) {
      const allowed = Array.isArray(expect) ? expect : [expect];
      if (!allowed.includes(res.status)) {
        const code = json && typeof json === 'object' ? `${json.code ?? ''} ${json.detail ?? json.title ?? ''}` : String(text).slice(0, 200);
        throw new StepError(`${this.label}: ${method} ${path} → ${res.status} (expected ${allowed.join('|')}) ${code}`.trim());
      }
    }
    return out;
  }

  get(path, opts) { return this.request('GET', path, opts); }
  post(path, body, opts) { return this.request('POST', path, { ...opts, body: body ?? {} }); }
  put(path, body, opts) { return this.request('PUT', path, { ...opts, body }); }

  /** GET that must return 200; resolves to the JSON body. */
  async ok(path) { return (await this.get(path, { expect: 200 })).json; }
}

/** Logs in (once — the API allows 5 logins/min per IP+email) and returns a client bound to the first branch. */
export async function login(email, password = PASSWORD, { branchId } = {}) {
  const anon = new Client(email);
  const res = await anon.post('/auth/login', { email, password }, { expect: 200 });
  const me = res.json.user;
  const client = new Client(email.split('@')[0], res.json.accessToken, branchId ?? me.branches?.[0]?.id ?? null);
  client.me = me;
  return client;
}

/** SignalR connection that buffers every server event so steps can await a matching one. */
export class Listener {
  constructor(label, token) {
    this.label = label;
    this.events = [];
    this.waiters = [];
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${ORIGIN}/hubs/restaurant`, { accessTokenFactory: () => token, transport: signalR.HttpTransportType.WebSockets, skipNegotiation: true })
      .configureLogging(signalR.LogLevel.Warning)
      .build();
  }

  listen(...names) {
    for (const name of names) {
      this.connection.on(name, (payload) => {
        const event = { name, payload, at: performance.now() };
        this.events.push(event);
        this.waiters = this.waiters.filter((w) => {
          if (w.name === name && w.predicate(payload)) { w.resolve(event); return false; }
          return true;
        });
      });
    }
    return this;
  }

  async start() { await this.connection.start(); return this; }
  invoke(method, ...args) { return this.connection.invoke(method, ...args); }
  stop() { return this.connection.stop(); }

  /** Resolves with the first (already received or future) event matching `predicate`, or rejects after `timeoutMs`. */
  waitFor(name, predicate = () => true, timeoutMs = 2000) {
    const existing = this.events.find((e) => e.name === name && predicate(e.payload));
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { name, predicate, resolve };
      this.waiters.push(waiter);
      setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new StepError(`${this.label}: no ${name} within ${timeoutMs} ms`));
      }, timeoutMs);
    });
  }

  count(name, predicate = () => true) {
    return this.events.filter((e) => e.name === name && predicate(e.payload)).length;
  }
}

export function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIn(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Current-branch ingredient balances: Map(ingredientId → quantity in base unit). */
export async function balances(client) {
  const page = await client.ok('/ingredients?pageSize=100');
  return new Map(page.items.map((i) => [i.id, Number(i.quantity)]));
}
