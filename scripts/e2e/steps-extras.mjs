// Extra checks: StockLow realtime, public demo request, CORS preflight, platform admin + tenant isolation, break-glass.
import { randomUUID } from 'node:crypto';
import { API, Client, check, eq, login, money, step } from './lib.mjs';

async function preflight(origin) {
  const res = await fetch(`${API}/orders`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,x-branch-id,idempotency-key' },
  });
  return { status: res.status, allowOrigin: res.headers.get('access-control-allow-origin'), credentials: res.headers.get('access-control-allow-credentials') };
}

export async function extraSteps(ctx) {
  await step('   StockLow: write-off below minimum emits the realtime event + notification; receipt restores', async () => {
    const page = await ctx.stock.ok('/ingredients?pageSize=100');
    const ingredient = page.items.find((i) => !i.isLow && Number(i.minQuantity) > 0 && Number(i.quantity) > Number(i.minQuantity));
    check(ingredient, 'no ingredient above its minimum');
    const drop = Math.round((Number(ingredient.quantity) - Number(ingredient.minQuantity) + 1) * 1000) / 1000;
    const event = ctx.stockHub.waitFor('StockLow', (p) => p.ingredientId === ingredient.id);
    await ctx.stock.post('/stock/movements', { ingredientId: ingredient.id, type: 'write_off', quantity: drop, unitId: null, unitCost: null, reason: 'e2e StockLow check' }, { expect: [200, 201] });
    const received = await event;
    eq(received.payload.name, ingredient.name, 'StockLow payload name');
    const low = (await ctx.stock.ok('/ingredients?lowStock=true&pageSize=100')).items;
    check(low.some((i) => i.id === ingredient.id), 'ingredient not reported as low');
    await ctx.stock.post('/stock/movements', { ingredientId: ingredient.id, type: 'receipt', quantity: drop, unitId: null, unitCost: Number(ingredient.costPrice), reason: 'e2e restore' }, { expect: [200, 201] });
    const stockNotifications = await ctx.stock.ok('/notifications?unreadOnly=true');
    check(stockNotifications.items.some((n) => n.type === 'stock_low'), 'no stock_low notification for the stock keeper');
    return `${ingredient.name}: −${drop} → StockLow received`;
  });

  await step('   landing: POST /public/demo-requests → 202 (honeypot → no 5xx)', async () => {
    const anon = new Client('anon');
    await anon.post('/public/demo-requests', {
      name: 'E2E Tester', phone: '+998901234567', email: `e2e.${ctx.run}@example.com`, restaurantName: `E2E ${ctx.run}`, city: 'Ташкент', message: 'e2e smoke', website: '',
    }, { expect: 202 });
    const plans = await anon.ok('/public/plans');
    check(plans.length > 0, 'no public plans');
  });

  await step('   CORS preflight allowed for http://localhost:5173 and :5174, refused for others', async () => {
    for (const origin of ['http://localhost:5173', 'http://localhost:5174']) {
      const res = await preflight(origin);
      check(res.status === 204 || res.status === 200, `${origin} preflight → ${res.status}`);
      eq(res.allowOrigin, origin, `${origin} Access-Control-Allow-Origin`);
      eq(res.credentials, 'true', `${origin} Access-Control-Allow-Credentials`);
    }
    const evil = await preflight('http://evil.example');
    eq(evil.allowOrigin, null, 'foreign origin must not be allowed');
  });

  await step('   platform admin creates a 2nd org; its owner cannot see the demo order (404/403)', async () => {
    ctx.platform = await login('superadmin@respos.uz');
    check(ctx.platform.me.isPlatformAdmin, 'superadmin is not a platform admin');
    const me = await ctx.platform.ok('/auth/me');
    check(me.isPlatformAdmin, '/auth/me isPlatformAdmin');
    const slug = `e2e-${ctx.run}`;
    const ownerEmail = `owner.${ctx.run}@e2e.respos.uz`;
    const ownerPassword = `Own-${ctx.run}-pass1`;
    const created = await new Client('platform', ctx.platform.token).post('/platform/organizations', {
      name: `E2E Org ${ctx.run}`, slug, currency: 'UZS', ownerEmail, ownerFullName: 'E2E Owner', ownerPassword, planCode: 'starter', branchName: 'E2E Branch',
    }, { expect: 201 });
    ctx.otherOrgId = created.json.id;
    const owner = await login(ownerEmail, ownerPassword);
    check(owner.branchId && owner.branchId !== ctx.branchId, 'second org owner has no own branch');
    eq(owner.me.currentOrganization.id, ctx.otherOrgId, 'owner org');
    eq((await owner.get(`/orders/${ctx.order.id}`)).status, 404, 'foreign order by id');
    eq((await owner.post(`/orders/${ctx.order.id}/cancel`, { reason: 'x' })).status, 404, 'cancel foreign order');
    eq((await owner.post('/payments', { orderId: ctx.order.id, method: 'cash', amount: 1 }, { headers: { 'Idempotency-Key': randomUUID() } })).status, 404, 'pay foreign order');
    const foreignBranch = new Client('owner-foreign-branch', owner.token, ctx.branchId);
    const forbidden = await foreignBranch.get('/tables');
    eq(forbidden.status, 403, 'X-Branch-Id of the demo org');
    eq(forbidden.json.code, 'tenant.branch_forbidden', 'foreign branch code');
    const items = (await owner.ok('/menu/items?pageSize=100')).items;
    eq(items.length, 0, 'new org sees demo menu items');
    const orders = (await owner.ok('/orders?pageSize=100')).items;
    eq(orders.length, 0, 'new org sees demo orders');
    return `org ${slug}`;
  });

  await step('   platform admin without break-glass cannot read tenant data; break-glass is read-only', async () => {
    const demoOrgId = ctx.admin.me.currentOrganization.id;
    const plain = new Client('platform', ctx.platform.token, ctx.branchId);
    check([403, 404].includes((await plain.get(`/orders/${ctx.order.id}`)).status), 'platform admin read tenant order without break-glass');
    const access = await new Client('platform', ctx.platform.token).post(`/platform/organizations/${demoOrgId}/access`, { reason: 'e2e support check' }, { expect: [200, 201] });
    const token = access.json.accessToken ?? access.json.token;
    check(token, `no token in break-glass response ${JSON.stringify(access.json).slice(0, 200)}`);
    const glass = new Client('break-glass', token, ctx.branchId);
    const me = await glass.get('/auth/me');
    eq(me.status, 200, 'break-glass /auth/me');
    eq(me.json.currentOrganization?.id, demoOrgId, 'break-glass /auth/me org');
    const order = await glass.get(`/orders/${ctx.order.id}`);
    eq(order.status, 200, 'break-glass read order');
    eq(money(order.json.total), money(ctx.order.total), 'break-glass order total');
    eq((await glass.post(`/orders/${ctx.order.id}/cancel`, { reason: 'x' })).status, 403, 'break-glass write');
  });
}
