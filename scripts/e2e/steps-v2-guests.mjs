// v2 E2E: guests + loyalty (F1), split bill + tips (F2), delivery (F3), QR menu + waiter calls (F3).
import { randomUUID } from 'node:crypto';
import { API, check, eq, money, step } from './lib.mjs';

const LOYALTY = { isEnabled: true, earnPercent: 10, maxRedeemPercent: 50, minOrderAmount: 0, pointsExpiryDays: null };

/** Menu item without modifier groups (Самса, Компот, …) from the POS menu. */
function simpleItems(pos) {
  const items = pos.flatMap((c) => c.items).filter((i) => i.modifierGroups.length === 0 && i.variants.length === 0 && i.isAvailable);
  check(items.length >= 2, 'demo POS menu has fewer than 2 simple items');
  return items;
}

const line = (item, quantity = 1) => ({ menuItemId: item.id, variantId: null, quantity, modifierOptionIds: [], comment: null });
const pay = (client, body) => client.post('/payments', body, { headers: { 'Idempotency-Key': randomUUID() }, expect: 201 });

async function points(client, customerId) {
  return Number((await client.ok(`/customers/${customerId}`)).loyalty.points);
}

export async function guestSteps(ctx) {
  await step('v2.1 guest: cashier creates a guest, waiter attaches it, payment earns points', async () => {
    await ctx.admin.put('/loyalty/settings', LOYALTY, { expect: 200 });
    ctx.simple = simpleItems(ctx.pos);
    const digits = String(Date.now()).slice(-7);
    const typed = `90 ${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    ctx.customer = (await ctx.cashier.post('/customers', { phone: typed, name: `E2E Гость ${ctx.run}`, marketingConsent: true }, { expect: 201 })).json;
    eq(ctx.customer.phone, `+99890${digits}`, 'phone normalized to E.164');
    const before = await points(ctx.cashier, ctx.customer.id);
    const order = (await ctx.waiter.post('/orders', { type: 'takeaway', guestCount: 1, items: [line(ctx.simple[0], 2)] }, { expect: 201 })).json;
    const attached = (await ctx.waiter.post(`/orders/${order.id}/customer`, { customerId: ctx.customer.id }, { expect: 200 })).json;
    eq(attached.customer?.id, ctx.customer.id, 'OrderDto.customer');
    const loyalty = await ctx.cashier.ok(`/orders/${order.id}/loyalty`);
    eq(money(loyalty.expectedEarn), Math.floor(Number(order.total) * 0.1), 'expectedEarn');
    await pay(ctx.cashier, { orderId: order.id, method: 'cash', amount: order.total });
    const earned = (await points(ctx.cashier, ctx.customer.id)) - before;
    eq(earned, Math.floor(Number(order.total) * 0.1), 'points earned on payment');
    const ledger = await ctx.cashier.ok(`/customers/${ctx.customer.id}/loyalty/transactions`);
    check(ledger.items.some((t) => t.type === 'earn' && t.orderId === order.id), 'earn entry missing in the ledger');
    return `${ctx.customer.phone}: order total ${order.total} → +${earned} points`;
  });

  await step('v2.2 next order: redeem points, split equally, pay both bills (one with a tip)', async () => {
    const balance = await points(ctx.cashier, ctx.customer.id);
    let order = (await ctx.waiter.post('/orders', { type: 'takeaway', guestCount: 2, items: [line(ctx.simple[0], 3), line(ctx.simple[1])] }, { expect: 201 })).json;
    await ctx.waiter.post(`/orders/${order.id}/customer`, { customerId: ctx.customer.id }, { expect: 200 });
    const loyalty = await ctx.cashier.ok(`/orders/${order.id}/loyalty`);
    const redeem = Math.min(1000, Number(loyalty.maxRedeemable));
    check(redeem > 0, `nothing redeemable (balance ${balance}, max ${loyalty.maxRedeemable})`);
    order = (await ctx.cashier.post(`/orders/${order.id}/loyalty/redeem`, { points: redeem }, { expect: 200 })).json;
    eq(money(order.loyaltyDiscountAmount), redeem, 'loyaltyDiscountAmount');
    eq(money(order.total), money(Number(order.subtotal) - redeem), 'total after points');
    order = (await ctx.waiter.post(`/orders/${order.id}/split`, { mode: 'equal', parts: 2 }, { expect: 200 })).json;
    check(order.isSplit && order.bills.length === 2, 'order not split into 2 bills');
    eq(money(order.bills[0].amount + order.bills[1].amount), money(order.total), 'Σ bills == total');
    const blocked = await ctx.cashier.request('DELETE', `/orders/${order.id}/loyalty/redeem`, { expect: 409 });
    eq(blocked.json.code, 'order.split_active', 'points cannot change while split');
    await pay(ctx.cashier, { orderId: order.id, billId: order.bills[0].id, method: 'cash', amount: order.bills[0].amount });
    const tipped = await pay(ctx.cashier, { orderId: order.id, billId: order.bills[1].id, method: 'card', amount: order.bills[1].amount, tipAmount: 2000 });
    eq(money(tipped.json.tipAmount), 2000, 'tipAmount');
    const paid = await ctx.cashier.ok(`/orders/${order.id}`);
    eq(paid.status, 'paid', 'order paid when all bills are paid');
    eq(money(paid.paidAmount), money(order.total), 'tip is not part of paidAmount');
    const after = await points(ctx.cashier, ctx.customer.id);
    eq(after, balance - redeem + Math.floor(Number(order.total) * 0.1), 'balance = before − redeemed + earned');
    ctx.splitOrder = paid;
    return `−${redeem} points, bills ${order.bills.map((b) => b.amount).join(' + ')}, tip 2000; balance ${balance} → ${after}`;
  });

  await step('v2.3 delivery: courier, kitchen auto-ready, on the way → delivered, paid with a tip', async () => {
    const settings = await ctx.admin.ok(`/branches/${ctx.branchId}/delivery-settings`);
    if (Number(settings.deliveryFee) === 0) {
      await ctx.admin.put(`/branches/${ctx.branchId}/delivery-settings`, { slug: settings.slug, deliveryFee: 10000 }, { expect: 200 });
    }
    const fee = Number((await ctx.admin.ok(`/branches/${ctx.branchId}/delivery-settings`)).deliveryFee);
    const courier = (await ctx.cashier.post('/delivery/couriers', { name: `Курьер ${ctx.run}`, phone: '90 555 44 33', isActive: true }, { expect: 201 })).json;
    const updated = ctx.cashierHub.waitFor('DeliveryUpdated', (p) => p.status === 'new', 3000);
    let delivery = (await ctx.cashier.post('/delivery/orders', {
      customerName: 'E2E Доставка', customerPhone: '+998 90 111 22 33', address: 'ул. Амира Темура, 1', items: [line(ctx.simple[0], 2)],
    }, { expect: 201 })).json;
    await updated;
    eq(money(delivery.deliveryFee), fee, 'delivery fee snapshot');
    eq(money(delivery.total), money(Number(delivery.subtotal) + fee), 'fee on top of the food');
    const id = delivery.orderId;
    await ctx.cashier.post(`/delivery/orders/${id}/status`, { status: 'accepted' }, { expect: 200 });
    const tickets = (await ctx.cook.ok('/kitchen/tickets')).filter((t) => t.orderId === id);
    check(tickets.length > 0, 'accepted delivery has no kitchen ticket');
    for (const t of tickets) {
      await ctx.cook.post(`/kitchen/tickets/${t.id}/start`, {}, { expect: 200 });
      await ctx.cook.post(`/kitchen/tickets/${t.id}/ready`, {}, { expect: 200 });
    }
    eq((await ctx.cashier.ok(`/delivery/orders/${id}`)).status, 'ready', 'auto ready after KDS');
    const noCourier = await ctx.cashier.post(`/delivery/orders/${id}/status`, { status: 'on_the_way' }, { expect: 422 });
    eq(noCourier.json.code, 'delivery.courier_required', 'courier required');
    await ctx.cashier.post(`/delivery/orders/${id}/courier`, { courierId: courier.id }, { expect: 200 });
    await ctx.cashier.post(`/delivery/orders/${id}/status`, { status: 'on_the_way' }, { expect: 200 });
    delivery = (await ctx.cashier.post(`/delivery/orders/${id}/status`, { status: 'delivered' }, { expect: 200 })).json;
    eq(delivery.allowedTransitions.length, 0, 'delivered is terminal');
    await pay(ctx.cashier, { orderId: id, method: 'cash', amount: delivery.total, tipAmount: 3000 });
    eq((await ctx.cashier.ok(`/orders/${id}`)).status, 'paid', 'delivery order paid');
    return `#${delivery.orderNumber}: ${delivery.subtotal} + fee ${fee} = ${delivery.total}, courier ${courier.name}, tip 3000`;
  });

  await step('v2.4 QR menu: public menu (ETag/304) + call waiter → WaiterCalled realtime → acknowledge', async () => {
    const res = await fetch(`${API}/public/menu/demo`);
    eq(res.status, 200, 'GET /public/menu/demo');
    const menu = await res.json();
    check(menu.categories.length > 0 && menu.categories.every((c) => c.items.length > 0), 'public menu empty');
    check(menu.isDemo === true, 'demo menu must be flagged isDemo');
    const etag = res.headers.get('etag');
    check(etag, 'no ETag');
    eq((await fetch(`${API}/public/menu/demo`, { headers: { 'If-None-Match': etag } })).status, 304, 'If-None-Match');
    const called = ctx.waiterHub.waitFor('WaiterCalled', (p) => p.tableNumber === ctx.table.number, 3000);
    const call = await fetch(`${API}/public/menu/demo/call-waiter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableNumber: ctx.table.number, reason: 'call' }),
    });
    eq(call.status, 202, 'call-waiter');
    const event = await called;
    const calls = await ctx.waiter.ok('/waiter-calls');
    check(calls.some((c) => c.id === event.payload.callId), 'call missing in /waiter-calls');
    const ack = (await ctx.waiter.post(`/waiter-calls/${event.payload.callId}/acknowledge`, {}, { expect: 200 })).json;
    eq(ack.status, 'acknowledged', 'call acknowledged');
    return `${menu.categories.length} categories; table ${ctx.table.number} call → WaiterCalled → acknowledged`;
  });
}
