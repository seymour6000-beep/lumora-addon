'use strict';
/* End-to-end tests: start a real server on a temp folder and run every flow through the API. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { create, loadConfig, fuelCents, includedTax } = require('../server');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hlpos-'));
const app = create({ ...loadConfig({}), dataDir: dir, quiet: true, tickMs: 20 });
let base;
const jars = {};
async function call(who, method, url, body) {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', cookie: jars[who] || '' }, body: body ? JSON.stringify(body) : undefined });
  const c = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (c.length) jars[who] = c.map((x) => x.split(';')[0]).join('; ');
  const data = await r.json();
  return { status: r.status, data };
}
const ok = async (...a) => { const r = await call(...a); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await sleep(25); } throw new Error('timed out'); }
const pump = async (n) => (await ok('o', 'GET', '/api/bootstrap')).pumps[n - 1];

test.before(async () => { await new Promise((r) => app.server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + app.server.address().port; });
test.after(async () => { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('money math', () => {
  assert.equal(fuelCents(40000, 1459), 5836); /* 40 L at 145.9 */
  assert.equal(includedTax(11400, 1400), 1400);
});

test('first-run setup, sign-in and the shift gate', async () => {
  assert.equal((await ok('x', 'GET', '/api/hello')).setup, true);
  await ok('o', 'POST', '/api/setup', { name: 'Olive', username: 'olive', password: 'secret1', storeName: 'Test Stop' });
  assert.equal((await call('x', 'POST', '/api/setup', { username: 'z', password: 'zzzzzz' })).status, 409);
  assert.equal((await call('x', 'GET', '/api/bootstrap')).status, 401);
  await ok('o', 'PUT', '/api/settings', { simSpeed: 20 });
  const r = await call('o', 'POST', '/api/sale', { lines: [{ type: 'item', sku: '301', qty: 1 }], tenders: [{ type: 'cash', cents: 500 }] });
  assert.equal(r.data.error, 'no_shift');
  await ok('o', 'POST', '/api/shift/open', { floatCents: 20000 });
});

test('store sale with tax, change, stock and car wash codes', async () => {
  const q = await ok('o', 'POST', '/api/quote', { lines: [{ type: 'item', sku: '301', qty: 2 }, { type: 'item', sku: '500', qty: 1 }, { type: 'item', sku: '800', qty: 1 }] });
  assert.equal(q.subtotalCents, 438 + 529 + 1000);
  assert.equal(q.addedTaxCents, Math.round((438 + 1000) * 0.14)); /* milk is not taxed */
  const short = await call('o', 'POST', '/api/sale', { lines: [{ type: 'item', sku: '301', qty: 1 }], tenders: [{ type: 'cash', cents: 100 }] });
  assert.equal(short.data.error, 'short');
  const tx = await ok('o', 'POST', '/api/sale', { lines: [{ type: 'item', sku: '301', qty: 2 }, { type: 'item', sku: '500', qty: 1 }, { type: 'item', sku: '800', qty: 1 }], tenders: [{ type: 'cash', cents: 5000 }] });
  assert.equal(tx.changeCents, 5000 - q.totalCents);
  assert.match(tx.lines[2].washCodes[0], /^\d{5}$/);
  const b = await ok('o', 'GET', '/api/bootstrap');
  assert.equal(b.products.find((p) => p.sku === '301').stock, 38);
});

test('age-restricted items need an ID check', async () => {
  const body = { lines: [{ type: 'item', sku: '700', qty: 1 }], tenders: [{ type: 'card', cents: 2165, brand: 'Visa' }] };
  assert.equal((await call('o', 'POST', '/api/sale', body)).data.error, 'age_check');
  await ok('o', 'POST', '/api/sale', { ...body, ageChecked: true });
});

let member;
test('loyalty: join, earn, redeem', async () => {
  member = await ok('o', 'POST', '/api/members', { phone: '(902) 555-0101', name: 'Sam' });
  assert.equal((await call('o', 'POST', '/api/members', { phone: '9025550101' })).status, 409);
  await ok('o', 'PUT', '/api/members/' + member.id, { addPoints: 20000 });
  const tx = await ok('o', 'POST', '/api/sale', { memberId: member.id, lines: [{ type: 'item', sku: '400', qty: 2 }],
    tenders: [{ type: 'points', cents: 1000 }, { type: 'cash', cents: 1000 }] });
  assert.equal(tx.pointsRedeemed, 10000);
  assert.equal(tx.pointsEarned, 129); /* $12.98 of store items x 10, rounded down */
  const m = (await ok('o', 'GET', '/api/members?q=5550101')).members[0];
  assert.equal(m.points, 20000 - 10000 + 129);
  assert.equal((await call('o', 'POST', '/api/sale', { lines: [{ type: 'item', sku: '303', qty: 1 }], tenders: [{ type: 'points', cents: 100 }] })).data.error, 'no_member');
});

test('postpay: authorize, pump, pay with fuel saver discount', async () => {
  await ok('o', 'PUT', '/api/members/' + member.id, { fuelSaverCpl: 5 });
  await ok('o', 'POST', '/api/pumps/1/authorize', { memberId: member.id });
  await ok('o', 'POST', '/api/sim/pumps/1/lift', { grade: 'reg' });
  await sleep(300);
  await ok('o', 'POST', '/api/sim/pumps/1/hangup', {});
  const p = await pump(1);
  assert.equal(p.status, 'done');
  assert.ok(p.ml > 0 && p.discountCents === Math.min(p.cents, Math.round((p.ml / 1000) * 5)));
  assert.equal(p.owedCents, p.cents - p.discountCents);
  const before = (await ok('o', 'GET', '/api/members?q=5550101')).members[0].points;
  const tx = await ok('o', 'POST', '/api/sale', { memberId: member.id, lines: [{ type: 'postpay', pump: 1 }], tenders: [{ type: 'card', cents: p.owedCents, brand: 'Mastercard' }] });
  assert.equal(tx.totalCents, p.owedCents);
  assert.equal((await pump(1)).status, 'idle');
  assert.equal((await ok('o', 'GET', '/api/members?q=5550101')).members[0].points, before + Math.floor((p.ml / 1000) * 10));
});

test('prepay: stops at the limit, and change is refunded when it stops short', async () => {
  await ok('o', 'POST', '/api/sale', { lines: [{ type: 'prepay', pump: 2, cents: 1000, grade: 'reg' }], tenders: [{ type: 'cash', cents: 1000 }] });
  assert.equal((await pump(2)).status, 'authorized');
  assert.equal((await call('o', 'POST', '/api/sale', { lines: [{ type: 'prepay', pump: 2, cents: 500 }], tenders: [{ type: 'cash', cents: 500 }] })).data.error, 'pump_busy');
  await ok('o', 'POST', '/api/sim/pumps/2/lift', {});
  await waitFor(async () => (await pump(2)).status === 'idle');

  await ok('o', 'POST', '/api/sale', { lines: [{ type: 'prepay', pump: 3, cents: 50000 }], tenders: [{ type: 'card', cents: 50000, brand: 'Visa' }] });
  await ok('o', 'POST', '/api/sim/pumps/3/lift', { grade: 'dsl' });
  await sleep(150);
  await ok('o', 'POST', '/api/sim/pumps/3/hangup', {});
  const p = await pump(3);
  assert.equal(p.status, 'done');
  assert.equal(p.refundCents, 50000 - p.cents);
  const r = await ok('o', 'POST', '/api/pumps/3/refund-change', {});
  assert.equal(r.tenders[0].type, 'card');
  assert.equal(r.totalCents, -p.refundCents);
  assert.equal((await pump(3)).status, 'idle');
});

test('pay at the pump (outdoor card) records its own sale', async () => {
  await ok('o', 'POST', '/api/sim/pumps/4/card', { brand: 'Amex', member: '9025550101' });
  await ok('o', 'POST', '/api/sim/pumps/4/lift', { grade: 'max' });
  await sleep(150);
  await ok('o', 'POST', '/api/sim/pumps/4/hangup', {});
  const p = await pump(4);
  assert.equal(p.status, 'idle');
  const { tx } = await ok('o', 'GET', '/api/tx/' + p.lastTxId);
  assert.equal(tx.source, 'outdoor');
  assert.equal(tx.tenders[0].brand, 'Amex');
});

test('phone app: sign up, add card, pay for a pump, see the receipt', async () => {
  await ok('a', 'POST', '/api/app/signup', { phone: '9025550199', name: 'Ada', pin: '4321' });
  assert.equal((await call('a2', 'POST', '/api/app/login', { phone: '9025550199', pin: '0000' })).status, 401);
  const { wallet } = await ok('a', 'POST', '/api/app/wallet', { brand: 'Visa' });
  assert.equal((await call('a', 'POST', '/api/app/lift', {})).data.error, 'no_pump');
  await ok('a', 'POST', '/api/app/pay', { pump: 5, card: wallet[0].id, maxCents: 3000, grade: 'reg' });
  assert.equal((await call('a', 'POST', '/api/app/pay', { pump: 6, card: wallet[0].id, maxCents: 3000 })).data.error, 'active');
  await ok('a', 'POST', '/api/app/lift', {});
  await sleep(150);
  await ok('a', 'POST', '/api/app/stop', {});
  const me = await ok('a', 'GET', '/api/app/me');
  assert.equal(me.active, null);
  assert.equal(me.history[0].source, 'app');
  assert.ok(me.member.points > 0);
});

test('gift cards: sell, then pay with one', async () => {
  const tx = await ok('o', 'POST', '/api/sale', { lines: [{ type: 'giftsell', cents: 2500 }], tenders: [{ type: 'cash', cents: 2500 }] });
  const card = tx.lines[0].card;
  assert.match(card, /^6060\d{12}$/);
  assert.equal((await call('o', 'POST', '/api/sale', { lines: [{ type: 'item', sku: '602', qty: 1 }], tenders: [{ type: 'gift', card, cents: 3419 }] })).data.error, 'low_balance');
  await ok('o', 'POST', '/api/sale', { lines: [{ type: 'item', sku: '100', qty: 1 }], tenders: [{ type: 'gift', card, cents: 204 }] });
  assert.equal((await ok('o', 'GET', '/api/giftcards/' + card)).balance, 2500 - 204);
});

test('cashier refunds need a manager; roles are enforced', async () => {
  await ok('o', 'POST', '/api/users', { username: 'cal', name: 'Cal', role: 'cashier', password: '1234' });
  await ok('c', 'POST', '/api/login', { username: 'cal', password: '1234' });
  assert.equal((await call('c', 'GET', '/api/reports/day')).status, 403);
  assert.equal((await call('c', 'POST', '/api/users', { username: 'x2', password: '1234' })).status, 403);
  await ok('c', 'POST', '/api/shift/open', { floatCents: 10000 });
  const tx = await ok('c', 'POST', '/api/sale', { lines: [{ type: 'item', sku: '601', qty: 1 }], tenders: [{ type: 'cash', cents: 2000 }] });
  assert.equal((await call('c', 'POST', '/api/refund', { txId: tx.id })).status, 403);
  assert.equal((await call('c', 'POST', '/api/refund', { txId: tx.id, override: { username: 'olive', password: 'nope' } })).status, 403);
  const r = await ok('c', 'POST', '/api/refund', { txId: tx.id, reason: 'wrong oil', override: { username: 'olive', password: 'secret1' } });
  assert.equal(r.approvedBy, 'olive');
  assert.equal(r.tenders[0].cents, -tx.totalCents);
  assert.equal((await call('c', 'POST', '/api/refund', { txId: tx.id, override: { username: 'olive', password: 'secret1' } })).data.error, 'already');
  const close = await ok('c', 'POST', '/api/shift/close', { countedCents: 10000 });
  assert.equal(close.expectedCents, 10000); /* sale and refund cancel out */
  assert.equal(close.overShortCents, 0);
});

test('day report adds it all up', async () => {
  const r = await ok('o', 'GET', '/api/reports/day');
  assert.ok(r.sales >= 9 && r.refunds >= 2);
  assert.ok(r.fuel.Regular.ml > 0 && r.fuel.Diesel.ml > 0 && r.fuel['Harbour Max'].ml > 0);
  assert.equal(r.items['Potato chips'], undefined);
  assert.equal(r.items['Chocolate bar'].qty, 2);
  assert.ok(r.tenders.cash > 0 && r.tenders.Visa > 0 && r.tenders.gift > 0 && r.tenders.points > 0);
  assert.ok(r.pointsIssued > 0 && r.pointsRedeemed === 10000);
});

test('prices, emergency stop and data survive a restart', async () => {
  await ok('o', 'PUT', '/api/grades', { grades: [{ id: 'reg', price: 1499 }] });
  await ok('o', 'POST', '/api/pumps/7/authorize', {});
  await ok('o', 'POST', '/api/sim/pumps/7/lift', {});
  await sleep(100);
  await ok('o', 'POST', '/api/pumps/stop-all', {});
  assert.equal((await pump(7)).status, 'done');
  app.store.flush();
  const again = create({ ...loadConfig({}), dataDir: dir, quiet: true });
  assert.equal(again.store.db.grades[0].price, 1499);
  assert.ok(again.store.db.tx.length >= 11);
  await again.close();
});
