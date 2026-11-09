// Latency summary for spec §6.1 targets (typical API request ≤ 2 s, KDS event delivery ≤ 2 s).
import { percentile } from './lib.mjs';

export function perfReport(latencies, metrics) {
  const all = latencies.map((l) => l.ms);
  const byKey = new Map();
  for (const l of latencies) byKey.set(l.key, [...(byKey.get(l.key) ?? []), l.ms]);
  const rows = [...byKey.entries()]
    .map(([key, values]) => ({ key, n: values.length, p50: percentile(values, 50), max: Math.max(...values) }))
    .sort((a, b) => b.max - a.max);
  const data = {
    requests: all.length,
    p50: Math.round(percentile(all, 50)),
    p95: Math.round(percentile(all, 95)),
    max: Math.round(Math.max(0, ...all)),
    over2s: all.filter((v) => v > 2000).length,
    kdsDeliveryMs: metrics.kdsDeliveryMs ?? null,
    readyDeliveryMs: metrics.readyDeliveryMs ?? null,
    slowest: rows.slice(0, 8).map((r) => ({ ...r, p50: Math.round(r.p50), max: Math.round(r.max) })),
  };
  const lines = [
    '',
    `Perf: ${data.requests} REST calls — p50 ${data.p50} ms, p95 ${data.p95} ms, max ${data.max} ms, >2 s: ${data.over2s}`,
    `      KitchenTicketCreated delivered ${data.kdsDeliveryMs ?? '—'} ms after send-to-kitchen started; OrderItemReady ${data.readyDeliveryMs ?? '—'} ms after ready`,
    '      slowest endpoints (max): ' + data.slowest.slice(0, 5).map((r) => `${r.key} ${r.max} ms`).join('; '),
  ];
  return { data, text: lines.join('\n') };
}
