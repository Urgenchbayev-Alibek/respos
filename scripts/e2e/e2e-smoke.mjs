#!/usr/bin/env node
// RestaurantOS end-to-end smoke scenario (spec §16) against a running API.
// Usage: cd scripts/e2e && npm install && node e2e-smoke.mjs   (E2E_API_URL, default http://localhost:5080/api/v1)
// Needs the Development demo seed (demo users / Demo123!). Prints ✔/✘ per step, exits 1 on failure.
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { API, Listener, StepError, balances, check, eq, latencies, login, money, step, summary, todayIn } from './lib.mjs';
import { paymentSteps } from './steps-payment.mjs';
import { extraSteps } from './steps-extras.mjs';
import { perfReport } from './perf.mjs';

const ctx = { run: Date.now().toString(36), metrics: {} };
const listeners = [];
const today = () => todayIn(ctx.timezone);

async function connect(label, client, { kitchen = false } = {}) {
  const listener = new Listener(label, client.token).listen(
    'KitchenTicketCreated', 'KitchenTicketUpdated', 'OrderUpdated', 'OrderItemReady', 'TableUpdated',
    'PaymentRegistered', 'NotificationCreated', 'StockLow');
  await listener.start();
  await listener.invoke('JoinBranch', client.branchId);
  if (kitchen) await listener.invoke('JoinKitchenStation', client.branchId, null);
  listeners.push(listener);
  return listener;
}

/** Picks a POS item that has variants and modifier groups (falls back to any item with modifiers). */
function pickItems(pos) {
  const items = pos.flatMap((c) => c.items);
  const withBoth = items.find((i) => i.variants.length > 0 && i.modifierGroups.some((g) => g.options.length > 0));
  const withVariant = items.find((i) => i.variants.length > 1);
  const withModifiers = items.find((i) => i.modifierGroups.some((g) => g.options.some((o) => Number(o.priceDelta) > 0)));
  check(withVariant || withBoth, 'demo menu has no item with variants');
  check(withModifiers || withBoth, 'demo menu has no item with modifiers');
  return { variantItem: withBoth ?? withVariant, modifierItem: withModifiers ?? withBoth };
}

function modifierSelection(item) {
  // one option per group, respecting maxSelect; prefer a priced option so modifiers affect the total
  return item.modifierGroups.filter((g) => g.options.length > 0).map((g) => {
    const priced = g.options.find((o) => Number(o.priceDelta) > 0);
    return priced ?? g.options[0];
  });
}

async function scenario() {
  await step('0. demo users log in (admin, cook, cashier, manager, stock)', async () => {
    ctx.admin = await login('admin@demo.respos.uz');
    ctx.branchId = ctx.admin.branchId;
    check(ctx.branchId, 'admin has no branch');
    ctx.timezone = ctx.admin.me.branches[0].timezone;
    ctx.cook = await login('cook@demo.respos.uz', undefined, { branchId: ctx.branchId });
    ctx.cashier = await login('cashier@demo.respos.uz', undefined, { branchId: ctx.branchId });
    ctx.manager = await login('manager@demo.respos.uz', undefined, { branchId: ctx.branchId });
    ctx.stock = await login('stock@demo.respos.uz', undefined, { branchId: ctx.branchId });
    const me = await ctx.admin.ok('/auth/me');
    eq(me.email, 'admin@demo.respos.uz', '/auth/me email');
    return `branch ${ctx.admin.me.branches[0].name} (${ctx.timezone})`;
  });

  await step('1. admin creates a waiter with branch access; the waiter logs in', async () => {
    const roles = await ctx.admin.ok('/roles');
    const waiterRole = roles.find((r) => r.code === 'waiter');
    check(waiterRole, 'waiter role missing');
    const email = `e2e.waiter.${ctx.run}@demo.respos.uz`;
    const password = `E2e-${ctx.run}-pass1`;
    const created = await ctx.admin.post('/users', {
      email, fullName: `E2E Waiter ${ctx.run}`, phone: null, password, roleIds: [waiterRole.id], branchIds: [ctx.branchId],
    }, { expect: 201 });
    eq(created.json.status, 'active', 'new user status');
    check(created.json.branches.some((b) => b.id === ctx.branchId), 'branch access not stored');
    ctx.waiter = await login(email, password);
    eq(ctx.waiter.branchId, ctx.branchId, 'waiter branch');
    check(ctx.waiter.me.permissions.includes('orders.create'), 'waiter lacks orders.create');
    return email;
  });

  await step('   SignalR: cook joins branch + kitchen, waiter/cashier/stock join branch', async () => {
    ctx.cookHub = await connect('cook', ctx.cook, { kitchen: true });
    ctx.waiterHub = await connect('waiter', ctx.waiter);
    ctx.cashierHub = await connect('cashier', ctx.cashier);
    ctx.stockHub = await connect('stock', ctx.stock);
    // the hub must refuse a branch the user cannot access
    let refused = false;
    try { await ctx.waiterHub.invoke('JoinBranch', randomUUID()); } catch { refused = true; }
    check(refused, 'JoinBranch with a foreign branch was accepted');
    ctx.cookHub.connected = performance.now();
  });

  await step('   baseline: sales report, dashboard, ingredient balances', async () => {
    ctx.reportBefore = await ctx.manager.ok(`/reports/sales?from=${today()}&to=${today()}`);
    ctx.dashboardBefore = await ctx.manager.ok('/dashboard');
    ctx.ingredientsBefore = await balances(ctx.stock);
    return `revenue today ${ctx.reportBefore.totalRevenue}, orders ${ctx.reportBefore.ordersCount}`;
  });

  await step('2. waiter opens a table (dine-in order) → table occupied', async () => {
    const tables = await ctx.waiter.ok('/tables?status=available');
    check(tables.length > 0, 'no available tables');
    ctx.table = tables[0];
    const tableEvent = ctx.waiterHub.waitFor('TableUpdated', (p) => p.tableId === ctx.table.id && p.status === 'occupied');
    const res = await ctx.waiter.post('/orders', { type: 'dine_in', tableId: ctx.table.id, guestCount: 2, comment: 'e2e' }, { expect: 201 });
    ctx.order = res.json;
    eq(ctx.order.status, 'draft', 'new order status');
    eq(ctx.order.tableId, ctx.table.id, 'order table');
    const after = (await ctx.waiter.ok('/tables')).find((t) => t.id === ctx.table.id);
    eq(after.status, 'occupied', 'table status');
    eq(after.activeOrderId, ctx.order.id, 'table activeOrderId');
    await tableEvent;
    return `order #${ctx.order.number} at table ${ctx.table.number}`;
  });

  await step('3. waiter adds items (variant + modifiers), totals are server-calculated', async () => {
    ctx.pos = await ctx.waiter.ok('/menu/pos');
    const { variantItem, modifierItem } = pickItems(ctx.pos);
    const variant = variantItem.variants.find((v) => !v.isDefault) ?? variantItem.variants[0];
    const variantMods = modifierSelection(variantItem);
    const mods = modifierSelection(modifierItem);
    const lines = [
      { menuItemId: variantItem.id, variantId: variant.id, quantity: 2, modifierOptionIds: variantMods.map((o) => o.id), comment: 'e2e variant' },
    ];
    if (modifierItem.id !== variantItem.id) {
      lines.push({ menuItemId: modifierItem.id, variantId: null, quantity: 1, modifierOptionIds: mods.map((o) => o.id), comment: null });
    }
    const res = await ctx.waiter.post(`/orders/${ctx.order.id}/items`, { items: lines }, { expect: 200 });
    ctx.order = res.json;
    eq(ctx.order.items.length, lines.length, 'item count');
    const expectedSubtotal = money(
      (Number(variant.price) + variantMods.reduce((s, o) => s + Number(o.priceDelta), 0)) * 2
      + (lines.length > 1 ? Number(modifierItem.price) + mods.reduce((s, o) => s + Number(o.priceDelta), 0) : 0));
    eq(money(ctx.order.subtotal), expectedSubtotal, 'subtotal');
    const first = ctx.order.items.find((i) => i.menuItemId === variantItem.id);
    eq(first.variantName, variant.name, 'variant name');
    eq(first.modifiers.length, variantMods.length, 'modifier count');
    ctx.orderedItems = lines.map((l) => ({ menuItemId: l.menuItemId, variantId: l.variantId, quantity: l.quantity }));
    return `${variantItem.name} (${variant.name}) ×2 + ${lines.length > 1 ? modifierItem.name : '—'}; subtotal ${ctx.order.subtotal}, total ${ctx.order.total}`;
  });

  await step('3b. send to kitchen with Idempotency-Key; replay does not duplicate tickets', async () => {
    const key = randomUUID();
    const ticketEvent = ctx.cookHub.waitFor('KitchenTicketCreated', (p) => p.orderId === ctx.order.id, 2000);
    const sentAt = performance.now();
    const res = await ctx.waiter.post(`/orders/${ctx.order.id}/send-to-kitchen`, { itemIds: null }, { headers: { 'Idempotency-Key': key }, expect: 200 });
    eq(res.json.status, 'submitted', 'order status after send');
    check(res.json.items.every((i) => i.status === 'sent'), 'items not sent');
    const event = await ticketEvent;
    ctx.metrics.kdsDeliveryMs = Math.round(event.at - sentAt);
    const replay = await ctx.waiter.post(`/orders/${ctx.order.id}/send-to-kitchen`, { itemIds: null }, { headers: { 'Idempotency-Key': key }, expect: 200 });
    eq(replay.headers.get('idempotent-replayed'), 'true', 'Idempotent-Replayed header');
    const noKey = await ctx.waiter.post(`/orders/${ctx.order.id}/send-to-kitchen`, { itemIds: null });
    eq(noKey.status, 400, 'send without Idempotency-Key');
    ctx.order = res.json;
    return `KitchenTicketCreated after ${ctx.metrics.kdsDeliveryMs} ms (request+commit+push)`;
  });

  await step('4. cook received KitchenTicketCreated (≤2 s) and GET /kitchen/tickets shows it', async () => {
    const tickets = (await ctx.cook.ok('/kitchen/tickets')).filter((t) => t.orderId === ctx.order.id);
    check(tickets.length > 0, 'no tickets for the order');
    const events = ctx.cookHub.count('KitchenTicketCreated', (p) => p.orderId === ctx.order.id);
    eq(events, tickets.length, 'one KitchenTicketCreated per ticket (replay must not emit more)');
    const itemCount = tickets.reduce((s, t) => s + t.items.length, 0);
    eq(itemCount, ctx.order.items.length, 'ticket items == order items (no duplicates after replay)');
    check(tickets.every((t) => t.status === 'new' && t.orderNumber === ctx.order.number), 'ticket status/orderNumber');
    check(tickets.every((t) => t.tableNumber === ctx.table.number), 'ticket tableNumber');
    check(ctx.metrics.kdsDeliveryMs <= 2000, `KDS delivery ${ctx.metrics.kdsDeliveryMs} ms > 2000 ms`);
    ctx.tickets = tickets;
    return `${tickets.length} ticket(s): ${tickets.map((t) => `#${t.number} ${t.stationName}`).join(', ')}`;
  });

  await step('5. cook starts and marks tickets ready', async () => {
    for (const ticket of ctx.tickets) {
      const started = await ctx.cook.post(`/kitchen/tickets/${ticket.id}/start`, {}, { expect: 200 });
      eq(started.json.status, 'in_progress', 'ticket after start');
    }
    const mid = await ctx.waiter.ok(`/orders/${ctx.order.id}`);
    eq(mid.status, 'in_progress', 'order status after start');
    ctx.readyAt = performance.now();
    for (const ticket of ctx.tickets) {
      const ready = await ctx.cook.post(`/kitchen/tickets/${ticket.id}/ready`, {}, { expect: 200 });
      eq(ready.json.status, 'ready', 'ticket after ready');
    }
    await ctx.cookHub.waitFor('KitchenTicketUpdated', (p) => p.orderId === ctx.order.id && p.status === 'ready');
  });

  await step('6. waiter gets OrderItemReady/OrderUpdated, order ready, then serves all', async () => {
    const ready = await ctx.waiterHub.waitFor('OrderItemReady', (p) => p.orderId === ctx.order.id);
    ctx.metrics.readyDeliveryMs = Math.round(ready.at - ctx.readyAt);
    await ctx.waiterHub.waitFor('OrderUpdated', (p) => p.orderId === ctx.order.id && p.status === 'ready');
    const readyCount = ctx.waiterHub.count('OrderItemReady', (p) => p.orderId === ctx.order.id);
    eq(readyCount, ctx.order.items.length, 'one OrderItemReady per item');
    const order = await ctx.waiter.ok(`/orders/${ctx.order.id}`);
    eq(order.status, 'ready', 'order status');
    const served = await ctx.waiter.post(`/orders/${ctx.order.id}/serve-all`, {}, { expect: 200 });
    eq(served.json.status, 'served', 'order status after serve-all');
    check(served.json.items.every((i) => i.status === 'served'), 'items not served');
    ctx.order = served.json;
    return `OrderItemReady ${ctx.metrics.readyDeliveryMs} ms after the first ready call started`;
  });

  await paymentSteps(ctx);
  await extraSteps(ctx);
}

let exitCode = 0;
console.log(`RestaurantOS e2e smoke → ${API}`);
try {
  await scenario();
} catch (error) {
  exitCode = 1;
  if (!(error instanceof StepError)) console.error(error);
  else console.log(error.message);
} finally {
  await Promise.allSettled(listeners.map((l) => l.stop()));
}
const s = summary();
if (s.failed > 0) exitCode = 1;
const report = perfReport(latencies, ctx.metrics);
console.log(report.text);
if (process.env.E2E_PERF_JSON) await writeFile(process.env.E2E_PERF_JSON, JSON.stringify({ ...report.data, steps: s.results }, null, 2));
console.log(exitCode === 0 ? `\nE2E PASSED (${s.total} steps)` : `\nE2E FAILED (${s.failed} of ${s.total} steps failed)`);
process.exit(exitCode);
