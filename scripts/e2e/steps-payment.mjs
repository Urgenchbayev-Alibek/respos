// Steps 7–9: cashier payment (idempotency, overpay), stock consumption, reports/audit/notifications.
import { randomUUID } from 'node:crypto';
import { balances, check, eq, money, qty, step, todayIn } from './lib.mjs';

const UNIT_FACTORS = { 'g>kg': 0.001, 'ml>l': 0.001, 'kg>g': 1000, 'l>ml': 1000 };

function toBase(quantity, unitCode, baseUnitCode) {
  if (unitCode === baseUnitCode) return quantity;
  const factor = UNIT_FACTORS[`${unitCode}>${baseUnitCode}`];
  if (factor === undefined) throw new Error(`no test conversion ${unitCode}→${baseUnitCode}`);
  return quantity * factor;
}

/** Expected consumption per ingredient (base units) from the active recipes of the ordered lines. */
async function expectedConsumption(ctx) {
  const ingredients = new Map((await ctx.stock.ok('/ingredients?pageSize=100')).items.map((i) => [i.id, i]));
  const expected = new Map();
  for (const line of ctx.orderedItems) {
    const recipes = (await ctx.stock.ok(`/recipes?menuItemId=${line.menuItemId}`)).filter((r) => r.isActive);
    const recipe = recipes.find((r) => r.variantId === line.variantId) ?? recipes.find((r) => r.variantId === null);
    if (!recipe) continue;
    for (const ri of recipe.ingredients) {
      const base = toBase(Number(ri.quantity), ri.unitCode, ingredients.get(ri.ingredientId).baseUnitCode) * line.quantity;
      expected.set(ri.ingredientId, (expected.get(ri.ingredientId) ?? 0) + base);
    }
  }
  return expected;
}

async function orderMovements(ctx) {
  const page = await ctx.stock.ok('/stock/movements?sourceType=order&pageSize=100');
  return page.items.filter((m) => m.sourceId === ctx.order.id);
}

export async function paymentSteps(ctx) {
  const today = () => todayIn(ctx.timezone);

  await step('7. cashier opens a shift (if none) and pays: replay → one payment, overpay → 422', async () => {
    const current = await ctx.cashier.get('/cash-shifts/current', { expect: [200, 204] });
    ctx.shift = current.status === 200 ? current.json
      : (await ctx.cashier.post('/cash-shifts/open', { openingAmount: 100000 }, { expect: [200, 201] })).json;
    eq(ctx.shift.status, 'open', 'shift status');
    const total = money(ctx.order.total);
    check(total > 0, 'order total is 0');
    const first = money(Math.floor(total / 2));
    const key1 = randomUUID();
    const p1 = await ctx.cashier.post('/payments', { orderId: ctx.order.id, method: 'cash', amount: first }, { headers: { 'Idempotency-Key': key1 }, expect: [200, 201] });
    const replay = await ctx.cashier.post('/payments', { orderId: ctx.order.id, method: 'cash', amount: first }, { headers: { 'Idempotency-Key': key1 }, expect: [200, 201] });
    eq(replay.json.id, p1.json.id, 'replayed payment id');
    eq(replay.headers.get('idempotent-replayed'), 'true', 'Idempotent-Replayed header');
    const mid = await ctx.cashier.ok(`/orders/${ctx.order.id}`);
    eq(mid.payments.length, 1, 'payments after replay');
    eq(money(mid.remainingAmount), money(total - first), 'remaining after first payment');
    const over = await ctx.cashier.post('/payments', { orderId: ctx.order.id, method: 'card', amount: money(total - first + 1000) }, { headers: { 'Idempotency-Key': randomUUID() } });
    eq(over.status, 422, 'overpay status');
    eq(over.json.code, 'payment.exceeds_due', 'overpay code');
    const paidEvent = ctx.cashierHub.waitFor('PaymentRegistered', (p) => p.orderId === ctx.order.id && p.paymentId !== p1.json.id);
    const tableEvent = ctx.waiterHub.waitFor('TableUpdated', (p) => p.tableId === ctx.table.id && p.status === 'available');
    ctx.paymentKey2 = randomUUID();
    const p2 = await ctx.cashier.post('/payments', { orderId: ctx.order.id, method: 'card', amount: money(total - first) }, { headers: { 'Idempotency-Key': ctx.paymentKey2 }, expect: [200, 201] });
    ctx.payment2 = p2.json;
    const order = await ctx.cashier.ok(`/orders/${ctx.order.id}`);
    eq(order.status, 'paid', 'order status');
    eq(money(order.paidAmount), total, 'paidAmount');
    eq(money(order.remainingAmount), 0, 'remainingAmount');
    check(order.closedAt, 'closedAt not set');
    const table = (await ctx.cashier.ok('/tables')).find((t) => t.id === ctx.table.id);
    eq(table.status, 'available', 'table status after payment');
    eq(table.activeOrderId, null, 'table activeOrderId after payment');
    await paidEvent;
    await tableEvent;
    ctx.order = order;
    return `cash ${first} + card ${money(total - first)} = ${total}`;
  });

  await step('8. stock: consumption movements match recipes; repeated payment attempts do not re-consume', async () => {
    const movements = await orderMovements(ctx);
    check(movements.length > 0, 'no consumption movements for the order');
    check(movements.every((m) => m.type === 'consumption'), `unexpected movement types ${[...new Set(movements.map((m) => m.type))]}`);
    const expected = await expectedConsumption(ctx);
    check(expected.size > 0, 'ordered items have no recipes');
    const after = await balances(ctx.stock);
    for (const [ingredientId, amount] of expected) {
      const moved = movements.filter((m) => m.ingredientId === ingredientId).reduce((s, m) => s + Number(m.quantity), 0);
      eq(qty(-moved), qty(amount), `movement sum for ingredient ${ingredientId}`);
      eq(qty(ctx.ingredientsBefore.get(ingredientId) - after.get(ingredientId)), qty(amount), `balance decrease for ${ingredientId}`);
    }
    // replay the final payment and try a fresh one on the paid order → no new movements
    const replay = await ctx.cashier.post('/payments', { orderId: ctx.order.id, method: 'card', amount: ctx.payment2.amount }, { headers: { 'Idempotency-Key': ctx.paymentKey2 }, expect: [200, 201] });
    eq(replay.json.id, ctx.payment2.id, 'replayed final payment');
    const extra = await ctx.cashier.post('/payments', { orderId: ctx.order.id, method: 'cash', amount: 1 }, { headers: { 'Idempotency-Key': randomUUID() } });
    check([409, 422].includes(extra.status), `payment on a paid order → ${extra.status}`);
    const again = await orderMovements(ctx);
    eq(again.length, movements.length, 'movement count after replays');
    const order = await ctx.cashier.ok(`/orders/${ctx.order.id}`);
    eq(order.payments.length, 2, 'payment count after replays');
    return `${movements.length} movements over ${expected.size} ingredients; extra payment → ${extra.status} ${extra.json?.code ?? ''}`;
  });

  await step('9. manager sees the sale in reports/dashboard; audit + notifications exist', async () => {
    const total = money(ctx.order.total);
    const report = await ctx.manager.ok(`/reports/sales?from=${today()}&to=${today()}`);
    eq(money(report.totalRevenue - ctx.reportBefore.totalRevenue), total, 'report revenue delta');
    eq(report.ordersCount - ctx.reportBefore.ordersCount, 1, 'report orders delta');
    const day = report.byDay.find((d) => d.date === today());
    check(day && money(day.revenue) >= total, 'byDay has no row for today');
    const dashboard = await ctx.manager.ok('/dashboard');
    eq(money(dashboard.salesToday - ctx.dashboardBefore.salesToday), total, 'dashboard salesToday delta');
    eq(dashboard.ordersToday - ctx.dashboardBefore.ordersToday, 1, 'dashboard ordersToday delta');
    const top = await ctx.manager.ok(`/reports/top-items?from=${today()}&to=${today()}&limit=20`);
    check(ctx.orderedItems.every((l) => top.some((t) => t.menuItemId === l.menuItemId)), 'top-items lacks ordered items');
    const methods = await ctx.manager.ok(`/reports/payment-methods?from=${today()}&to=${today()}`);
    check(['cash', 'card'].every((m) => methods.some((x) => x.method === m)), 'payment-methods lacks cash/card');
    // order lifecycle lives in OrderStatusHistory; the audit log covers the critical actions (BR-17)
    const history = (await ctx.manager.ok(`/orders/${ctx.order.id}`)).history;
    check(['submitted', 'in_progress', 'ready', 'served', 'paid'].every((s) => history.some((h) => h.toStatus === s)), 'order history incomplete');
    const paymentAudit = await ctx.manager.ok(`/audit-logs?entityId=${ctx.payment2.id}&pageSize=10`);
    check(paymentAudit.items.some((a) => a.action === 'payment.registered'), 'no payment.registered audit entry');
    const userAudit = await ctx.manager.ok('/audit-logs?action=user.&pageSize=100');
    check(userAudit.items.some((a) => a.entityId === ctx.waiter.me.id), 'no audit entry for the created waiter');
    const audit = { items: [...paymentAudit.items, ...userAudit.items.filter((a) => a.entityId === ctx.waiter.me.id)] };
    const waiterUnread = await ctx.waiter.ok('/notifications/unread-count');
    const cookUnread = await ctx.cook.ok('/notifications/unread-count');
    const count = (x) => (typeof x === 'number' ? x : x.count ?? x.unreadCount);
    check(count(waiterUnread) > 0, `waiter unread-count ${JSON.stringify(waiterUnread)}`);
    check(count(cookUnread) > 0, `cook unread-count ${JSON.stringify(cookUnread)}`);
    const list = await ctx.waiter.ok('/notifications?unreadOnly=true');
    check(list.items.some((n) => n.type === 'order_ready'), 'waiter has no order_ready notification');
    check(ctx.waiterHub.count('NotificationCreated') > 0, 'waiter got no NotificationCreated event');
    return `revenue +${total}; audit ${audit.items.length} entries (${[...new Set(audit.items.map((a) => a.action))].join(', ')}); unread waiter ${count(waiterUnread)}, cook ${count(cookUnread)}`;
  });
}
