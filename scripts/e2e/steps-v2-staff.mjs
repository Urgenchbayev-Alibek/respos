// v2 E2E: time clock + timesheet (F6), shared device + PIN login (F6), analytics + XLSX (F5),
// integrations (F7, masked secrets) and the public online reservation by branch slug (F7).
import { API, check, eq, money, step, todayIn } from './lib.mjs';

const DEMO_WAITER_PIN = '2580';

/** Raw call that sends/receives the httpOnly device cookie by hand (fetch in Node has no cookie jar). */
async function deviceCall(method, path, { token, branchId, cookie, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (branchId) headers['X-Branch-Id'] = branchId;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, setCookies: res.headers.getSetCookie() };
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function staffSteps(ctx) {
  const today = todayIn(ctx.timezone);

  await step('v2.8 staff: waiter clocks in/out; manager sees the timesheet + CSV', async () => {
    const me = await ctx.waiter.ok('/staff/time-clock/me');
    eq(me.openEntry, null, 'new waiter has no open entry');
    const entry = (await ctx.waiter.post('/staff/time-clock/clock-in', { note: 'e2e' }, { expect: 201 })).json;
    check(entry.isOpen, 'entry not open');
    const again = await ctx.waiter.post('/staff/time-clock/clock-in', {}, { expect: 409 });
    eq(again.json.code, 'time_entry.already_open', 'double clock-in');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const closed = (await ctx.waiter.post('/staff/time-clock/clock-out', { breakMinutes: 0 }, { expect: 200 })).json;
    check(!closed.isOpen && closed.clockOutAt, 'entry not closed');
    const sheet = await ctx.manager.ok(`/staff/timesheet?from=${today}&to=${today}`);
    const row = sheet.rows.find((r) => r.userId === ctx.waiter.me.id);
    check(row, 'waiter missing in the timesheet');
    eq(row.entries, 1, 'timesheet entries');
    const csv = await fetch(`${API}/staff/timesheet/export?from=${today}&to=${today}`, {
      headers: { Authorization: `Bearer ${ctx.manager.token}`, 'X-Branch-Id': ctx.branchId },
    });
    eq(csv.status, 200, 'timesheet CSV');
    check((await csv.text()).includes('employee,date,planned_hours,worked_hours,difference_hours'), 'CSV header');
    return `${sheet.rows.length} employee row(s) today`;
  });

  await step('v2.9 PIN: manager registers a shared device; demo waiter logs in by PIN (branch-scoped); revoke', async () => {
    const reg = await deviceCall('POST', '/auth/device/register', { token: ctx.manager.token, branchId: ctx.branchId, body: { name: `E2E tablet ${ctx.run}` } });
    eq(reg.status, 201, 'device register');
    const raw = reg.setCookies.find((c) => c.startsWith('device_token='));
    check(raw && /httponly/i.test(raw), 'device_token is not an httpOnly cookie');
    check(!JSON.stringify(reg.json).includes(raw.split(';')[0].split('=')[1]), 'device token leaked into the body');
    const cookie = raw.split(';')[0];
    const staff = await deviceCall('GET', '/auth/device/staff', { cookie });
    eq(staff.status, 200, 'device staff list');
    const waiter = staff.json.find((s) => s.fullName === 'Азиз Хасанов');
    check(waiter, 'demo waiter (seeded PIN) missing on the lock screen');
    const wrong = await deviceCall('POST', '/auth/pin-login', { cookie, body: { userId: waiter.id, pin: '9999' } });
    eq(wrong.status, 401, 'wrong PIN');
    const login = await deviceCall('POST', '/auth/pin-login', { cookie, body: { userId: waiter.id, pin: DEMO_WAITER_PIN } });
    eq(login.status, 200, 'pin-login');
    eq(login.json.user.branches.length, 1, 'PIN session sees only the device branch');
    eq(login.json.user.branches[0].id, ctx.branchId, 'device branch');
    const foreign = await deviceCall('GET', '/orders', { token: login.json.accessToken, branchId: ctx.branch2Id });
    eq(foreign.status, 403, 'other branch with a PIN session');
    eq((await deviceCall('GET', '/orders', { token: login.json.accessToken, branchId: ctx.branchId })).status, 200, 'own branch');
    const revoked = await deviceCall('POST', `/staff/devices/${reg.json.id}/revoke`, { token: ctx.manager.token, branchId: ctx.branchId, body: {} });
    eq(revoked.status, 200, 'revoke device');
    const after = await deviceCall('POST', '/auth/pin-login', { cookie, body: { userId: waiter.id, pin: DEMO_WAITER_PIN } });
    eq(after.json?.code, 'device.invalid', 'revoked device');
    return `device ${reg.json.name}; ${staff.json.length} PIN user(s) on the lock screen`;
  });

  await step('v2.10 analytics: ABC, food cost, waiters (tips), heatmap, tips report + XLSX export', async () => {
    const q = `from=${today}&to=${today}`;
    const abc = await ctx.manager.ok(`/reports/abc?${q}`);
    check(abc.items.length > 0 && abc.items[0].class === 'A', 'ABC report empty or top item not A');
    const food = await ctx.manager.ok('/reports/food-cost');
    check(food.items.some((i) => i.hasRecipe), 'food cost has no item with a recipe');
    const waiters = await ctx.manager.ok(`/reports/waiters?${q}`);
    const mine = waiters.find((w) => w.waiterId === ctx.waiter.me.id);
    check(mine, 'e2e waiter missing in the waiter report');
    eq(money(mine.tipsAmount), 2000, 'waiter tips (split bill)');
    const heat = await ctx.manager.ok(`/reports/heatmap?${q}`);
    eq(heat.cells.length, 168, 'heatmap cells');
    check(heat.cells.some((c) => c.orders > 0), 'heatmap has no orders');
    const tips = await ctx.manager.ok(`/reports/tips?${q}`);
    check(Number(tips.totalTips) >= 5000, `tips report ${tips.totalTips} < 5000`);
    const xlsx = await fetch(`${API}/reports/abc/export?format=xlsx&${q}`, { headers: { Authorization: `Bearer ${ctx.manager.token}`, 'X-Branch-Id': ctx.branchId } });
    eq(xlsx.status, 200, 'xlsx export');
    check(xlsx.headers.get('content-type')?.includes('spreadsheetml'), 'xlsx content type');
    const bytes = new Uint8Array(await xlsx.arrayBuffer());
    check(bytes[0] === 0x50 && bytes[1] === 0x4b, 'xlsx is not a zip (PK)');
    return `ABC ${abc.items.length} items, waiter tips ${mine.tipsAmount}, tips total ${tips.totalTips}, xlsx ${bytes.length} B`;
  });

  await step('v2.11 integrations: secrets masked, test without config → 422; online booking by slug → pending', async () => {
    const list = await ctx.admin.ok('/integrations');
    eq(list.map((i) => i.type).sort().join(','), 'sms_eskiz,smtp,telegram', 'integration types');
    const token = `7000000001:E2E-secret-${ctx.run}`;
    const saved = await ctx.admin.put('/integrations/telegram', {
      isEnabled: false,
      config: { botToken: token, chatIds: ['100200300'], dailySummaryEnabled: false, dailySummaryTime: '21:00', lowStockEnabled: true,
        bigRefundEnabled: false, bigRefundThreshold: 0, onlineReservationEnabled: true, shiftDifferenceEnabled: false },
    }, { expect: 200 });
    const raw = JSON.stringify(saved.json) + JSON.stringify(await ctx.admin.ok('/integrations'));
    check(!raw.includes(token), 'bot token returned to the client');
    eq(saved.json.config.botToken, `****${token.slice(-4)}`, 'masked token');
    eq(saved.json.status, 'not_configured', 'disabled integration status');
    const test = await ctx.admin.post('/integrations/telegram/test', {}, { expect: 422 });
    eq(test.json.code, 'integration.not_configured', 'test of a disabled integration');

    const date = addDays(today, 3);
    const slots = await fetch(`${API}/public/branches/demo/availability?date=${date}&guests=2`).then((r) => r.json());
    eq(slots.branchSlug, 'demo', 'availability by slug');
    const slot = slots.slots.find((s) => s.available);
    check(slot, 'no free slot in 3 days');
    const booked = await fetch(`${API}/public/branches/demo/reservations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time: slot.time, guests: 2, name: `E2E Онлайн ${ctx.run}`, phone: '90 765 43 21', comment: 'e2e', website: '' }),
    });
    eq(booked.status, 201, 'online reservation');
    const created = await booked.json();
    eq(created.status, 'pending', 'online reservation status');
    const list2 = await ctx.admin.ok(`/reservations?date=${date}&status=pending&pageSize=100`);
    const items = Array.isArray(list2) ? list2 : list2.items;
    check(items.some((r) => r.id === created.reservationId), 'reservation not visible to the admin');
    return `telegram token masked; booking ${date} ${slot.time} → pending`;
  });
}
