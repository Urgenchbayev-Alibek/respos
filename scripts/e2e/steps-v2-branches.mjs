// v2 E2E: branch menu overrides (F4), stock transfers (F4), purchase suggestions (F4).
import { randomUUID } from 'node:crypto';
import { API, Client, check, eq, money, qty, step } from './lib.mjs';

export const SECOND_BRANCH = 'Ташкент — Чиланзар';

export async function branchSteps(ctx) {
  await step('v2.5 branch price override: POS menu and order snapshot of the 2nd branch use it', async () => {
    const second = ctx.manager.me.branches.find((b) => b.name === SECOND_BRANCH);
    check(second, `manager has no access to "${SECOND_BRANCH}" (DemoSecondBranchSeeder)`);
    ctx.branch2Id = second.id;
    ctx.managerB2 = new Client('manager@b2', ctx.manager.token, second.id);
    const mainItems = new Map((await ctx.manager.ok('/menu/pos')).flatMap((c) => c.items).map((i) => [i.id, Number(i.price)]));
    const b2Items = (await ctx.managerB2.ok('/menu/pos')).flatMap((c) => c.items);
    const overridden = b2Items.find((i) => mainItems.has(i.id) && Number(i.price) !== mainItems.get(i.id) && i.modifierGroups.every((g) => !g.isRequired));
    check(overridden, 'no price override visible in the 2nd branch POS menu');
    const matrix = await ctx.admin.ok(`/menu/items/${overridden.id}/branches`);
    const row = matrix.find((r) => r.branchId === second.id);
    check(row?.hasOverride, 'override matrix does not report the 2nd branch override');
    eq(money(row.effectivePrice), money(overridden.price), 'matrix effective price == POS price');
    const order = (await ctx.managerB2.post('/orders', {
      type: 'takeaway', guestCount: 1, items: [{ menuItemId: overridden.id, variantId: overridden.variants[0]?.id ?? null, quantity: 1, modifierOptionIds: [] }],
    }, { expect: 201 })).json;
    const unit = Number(order.items[0].unitPrice);
    const expected = overridden.variants[0] ? Number(overridden.variants[0].price) : Number(overridden.price);
    eq(money(unit), money(expected), 'order line price snapshot = branch price');
    check((await ctx.managerB2.ok(`/orders/${order.id}`)).id === order.id, 'order not readable in the 2nd branch');
    eq((await ctx.manager.get(`/orders/${order.id}`)).status, 404, 'order of the 2nd branch is not visible in the main branch');
    await ctx.managerB2.post(`/orders/${order.id}/cancel`, { reason: 'e2e override check' }, { expect: 200 });
    // the guest's QR menu of that branch must show the same price as its POS
    const slug = (await ctx.admin.ok('/branches')).find((b) => b.id === second.id)?.slug;
    check(slug, '2nd branch has no public slug');
    const publicMenu = await fetch(`${API}/public/menu/${slug}`).then((r) => r.json());
    const publicItem = publicMenu.categories.flatMap((c) => c.items).find((i) => i.id === overridden.id);
    eq(money(publicItem?.price), money(overridden.price), 'public QR menu price == branch POS price');
    return `${overridden.name}: ${mainItems.get(overridden.id)} → ${overridden.price} in "${SECOND_BRANCH}"`;
  });

  await step('v2.6 stock transfer: draft → send (transfer_out) → receive at the 2nd branch (idempotent)', async () => {
    const stockB2 = new Client('stock@b2', ctx.stock.token, ctx.branch2Id);
    check(ctx.stock.me.branches.some((b) => b.id === ctx.branch2Id), 'stock user has no access to the 2nd branch');
    const source = (await ctx.stock.ok('/ingredients?pageSize=100')).items.find((i) => Number(i.quantity) >= 2 && !i.isArchived);
    check(source, 'no ingredient with stock ≥ 2 in the main branch');
    const destBefore = (await stockB2.ok('/ingredients?pageSize=100')).items.find((i) => i.id === source.id);
    const draft = (await ctx.stock.post('/stock/transfers', {
      toBranchId: ctx.branch2Id, comment: `e2e ${ctx.run}`, lines: [{ ingredientId: source.id, quantity: 1, unitId: source.baseUnitId }],
    }, { expect: 201 })).json;
    eq(draft.status, 'draft', 'new transfer status');
    const sent = (await ctx.stock.post(`/stock/transfers/${draft.id}/send`, {}, { expect: 200 })).json;
    eq(sent.status, 'sent', 'sent');
    const srcAfter = (await ctx.stock.ok('/ingredients?pageSize=100')).items.find((i) => i.id === source.id);
    eq(qty(srcAfter.quantity), qty(Number(source.quantity) - 1), 'source balance −1');
    const incoming = await stockB2.ok('/stock/transfers?direction=incoming&status=sent');
    check(incoming.items.some((t) => t.id === draft.id), 'destination does not see the sent transfer');
    const key = randomUUID();
    const received = await stockB2.post(`/stock/transfers/${draft.id}/receive`, {}, { headers: { 'Idempotency-Key': key }, expect: 200 });
    eq(received.json.status, 'received', 'received');
    const replay = await stockB2.post(`/stock/transfers/${draft.id}/receive`, {}, { headers: { 'Idempotency-Key': key }, expect: 200 });
    eq(replay.headers.get('idempotent-replayed'), 'true', 'receive replay');
    const destAfter = (await stockB2.ok('/ingredients?pageSize=100')).items.find((i) => i.id === source.id);
    eq(qty(destAfter.quantity), qty(Number(destBefore?.quantity ?? 0) + 1), 'destination balance +1 (once)');
    const moves = await stockB2.ok(`/stock/movements?sourceType=transfer&ingredientId=${source.id}&pageSize=50`);
    check(moves.items.some((m) => m.sourceId === draft.id && m.type === 'transfer_in'), 'transfer_in movement missing');
    ctx.stockB2 = stockB2;
    return `#${draft.number}: 1 ${source.baseUnitCode} ${source.name} ${source.quantity} → ${srcAfter.quantity}; B2 ${destBefore?.quantity ?? 0} → ${destAfter.quantity}`;
  });

  await step('v2.7 purchase suggestions at the 2nd branch → apply → draft purchase orders per supplier', async () => {
    const suggestions = await ctx.stockB2.ok('/purchases/suggestions?coverageDays=7&lookbackDays=14');
    const lines = suggestions.groups.filter((g) => g.supplierId).flatMap((g) =>
      g.lines.map((l) => ({ ingredientId: l.ingredientId, supplierId: g.supplierId, quantity: l.suggestedQuantity, unitPrice: null })));
    check(lines.length > 0, 'no suggestions with a default supplier (seed has items below minimum)');
    const created = (await ctx.stockB2.post('/purchases/suggestions/apply', { lines, comment: `e2e ${ctx.run}` }, { expect: 201 })).json;
    eq(created.length, new Set(lines.map((l) => l.supplierId)).size, 'one draft per supplier');
    check(created.every((p) => p.status === 'draft'), 'purchases are drafts');
    // drafts count as "on order" — cancel them so the scenario stays re-runnable on the same DB
    for (const purchase of created) await ctx.stockB2.post(`/purchases/${purchase.id}/cancel`, {}, { expect: 200 });
    return `${lines.length} lines → ${created.length} draft PO(s) (cancelled afterwards)`;
  });
}
