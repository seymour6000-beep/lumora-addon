'use strict';
/* Harbourline POS server: a simulated Canadian fuel + convenience point of sale.
   No dependencies: needs only Node 18.17 or newer.
   Units used everywhere: money in cents, fuel prices in tenths of a cent per litre (1459 = 145.9 c/L),
   fuel volume in millilitres, tax rates in basis points (1400 = 14%).
   Everything payment-related is simulated: no real card data is ever taken or stored. */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const VERSION = require('./package.json').version;

const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || ''));
function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 8090,
    host: env.HOST || '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, 'data')),
    publicDir: path.join(__dirname, 'public'),
    quiet: truthy(env.QUIET),
    tickMs: Number(env.TICK_MS) || 250,
    timeZone: env.TZ_NAME || 'America/Halifax',
    cookieSecure: truthy(env.COOKIE_SECURE),
  };
}

/* ---------- defaults ---------- */
const DEFAULT_SETTINGS = {
  storeName: 'Harbourline Fuel & Market', address: '', taxBp: 1400, pumpCount: 8,
  ptsPerLitre: 10, ptsPerDollar: 10, ptsPerDollarRedeem: 1000, flowMlPerSec: 700, simSpeed: 4,
  outdoorPreauthCents: 15000, ageLimit: 19, footer: 'Thanks for stopping in. Drive safe!',
};
const DEFAULT_GRADES = [
  { id: 'reg', name: 'Regular', octane: '87', price: 1459, color: '#22c55e' },
  { id: 'plus', name: 'Plus', octane: '89', price: 1559, color: '#3b82f6' },
  { id: 'max', name: 'Harbour Max', octane: '91', price: 1679, color: '#a855f7' },
  { id: 'dsl', name: 'Diesel', octane: '', price: 1619, color: '#eab308' },
];
const P = (sku, name, cat, price, extra = {}) => ({ sku, barcode: '06281' + sku.replace(/\D/g, '').padStart(7, '0'), name, cat, price, taxable: true, age: false, wash: false, stock: 40, ...extra });
const DEFAULT_PRODUCTS = [
  P('100', 'Coffee small', 'Hot drinks', 179), P('101', 'Coffee medium', 'Hot drinks', 209), P('102', 'Coffee large', 'Hot drinks', 239),
  P('103', 'Hot chocolate', 'Hot drinks', 229),
  P('200', 'Spring water 500 mL', 'Cold drinks', 249), P('201', 'Cola 591 mL', 'Cold drinks', 299), P('202', 'Energy drink', 'Cold drinks', 399),
  P('203', 'Chocolate milk', 'Cold drinks', 279, { taxable: false }),
  P('300', 'Potato chips', 'Snacks', 299), P('301', 'Chocolate bar', 'Snacks', 219), P('302', 'Beef jerky', 'Snacks', 899), P('303', 'Gum', 'Snacks', 199),
  P('400', 'Turkey sandwich', 'Food', 649), P('401', 'Pizza slice', 'Food', 449), P('402', 'Breakfast wrap', 'Food', 529),
  P('500', 'Milk 2 L', 'Grocery', 529, { taxable: false }), P('501', 'White bread', 'Grocery', 399, { taxable: false }), P('502', 'Eggs dozen', 'Grocery', 549, { taxable: false }),
  P('600', 'Washer fluid 4 L', 'Auto', 599, { stock: 20 }), P('601', 'Motor oil 1 L', 'Auto', 1199, { stock: 15 }), P('602', 'Propane exchange', 'Auto', 2999, { stock: 8 }),
  P('603', 'Bag of ice', 'Auto', 399),
  P('700', 'Cigarettes', 'Age 19+', 1899, { age: true }), P('701', 'Lottery ticket', 'Age 19+', 300, { age: true, taxable: false, stock: 500 }),
  P('800', 'Basic wash', 'Car wash', 1000, { wash: true, stock: 9999 }), P('801', 'Deluxe wash', 'Car wash', 1400, { wash: true, stock: 9999 }),
  P('802', 'Ultimate wash', 'Car wash', 1800, { wash: true, stock: 9999 }),
];
const ROLES = { cashier: 1, manager: 2, owner: 3 };
const BRANDS = ['Visa', 'Mastercard', 'Amex', 'Interac'];

/* ---------- storage ---------- */
class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(path.join(dir, 'backups'), { recursive: true, mode: 0o700 });
    this.file = path.join(dir, 'pos.json');
    let db = null;
    try { db = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
    catch (e) {
      if (e.code !== 'ENOENT') {
        try { fs.copyFileSync(this.file, this.file + '.corrupt-' + Date.now()); } catch (_) { /* ignore */ }
        console.error('Could not read ' + this.file + ' (' + e.message + '). A copy was kept next to it. Starting fresh.');
      }
    }
    this.db = Object.assign({
      v: 1, settings: {}, grades: DEFAULT_GRADES, products: DEFAULT_PRODUCTS, users: {}, members: {}, giftcards: {},
      tx: [], shifts: [], pumps: [], seq: { tx: 0, member: 0, shift: 0 }, audit: [], sessions: {}, appSessions: {},
    }, db || {});
    this.db.settings = { ...DEFAULT_SETTINGS, ...this.db.settings };
    this.timer = null;
    this.backup();
  }
  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 300);
    this.timer.unref();
  }
  flush() {
    clearTimeout(this.timer); this.timer = null;
    try { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.db), { mode: 0o600 }); fs.renameSync(tmp, this.file); }
    catch (e) { console.error('Save failed:', e.message); }
  }
  backup() {
    try {
      if (!fs.existsSync(this.file)) return;
      const dir = path.join(this.dir, 'backups');
      const target = path.join(dir, 'pos-' + new Date().toISOString().slice(0, 10) + '.json');
      if (!fs.existsSync(target)) fs.copyFileSync(this.file, target);
      const old = fs.readdirSync(dir).filter((f) => /^pos-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      while (old.length > 14) fs.unlinkSync(path.join(dir, old.shift()));
    } catch (e) { console.error('Backup failed:', e.message); }
  }
}

/* ---------- passwords ---------- */
const scrypt = (pw, salt) => new Promise((res, rej) =>
  crypto.scrypt(String(pw), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + (await scrypt(pw, salt)).toString('hex');
}
async function checkPassword(pw, stored) {
  const [kind, saltHex, hashHex] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) { await scrypt(pw, Buffer.alloc(16)); return false; }
  const want = Buffer.from(hashHex, 'hex');
  const got = await scrypt(pw, Buffer.from(saltHex, 'hex'));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/* ---------- small helpers ---------- */
class ApiError extends Error { constructor(status, code, msg) { super(msg || code); this.status = status; this.code = code; } }
const fail = (status, code, msg) => { throw new ApiError(status, code, msg); };
const int = (v) => (Number.isInteger(v) ? v : (typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : NaN));
const clean = (s, n = 60) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');
const fuelCents = (ml, price) => Math.round((ml * price) / 10000);
const includedTax = (cents, bp) => cents - Math.round((cents * 10000) / (10000 + bp));
const randDigits = (n) => { let o = ''; const b = crypto.randomBytes(n); for (let i = 0; i < n; i++) o += String(b[i] % 10); return o; };
const money = (c) => (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toFixed(2);

function makePump(n) {
  return { n, status: 'idle', mode: null, grade: null, limitCents: 0, ml: 0, cents: 0, memberId: null, paidCents: 0,
    txId: null, tender: null, owedCents: 0, refundCents: 0, discountCents: 0, by: null, authAt: 0, startedAt: 0, endedAt: 0, lastTxId: null };
}

/* ---------- the app ---------- */
function create(cfg = loadConfig()) {
  const store = new Store(cfg.dataDir);
  const db = store.db;
  const S = () => db.settings;
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const hourFmt = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timeZone, hour: '2-digit', hourCycle: 'h23' });
  const localDay = (t) => dayFmt.format(new Date(t));

  function ensurePumps() {
    const n = Math.min(24, Math.max(1, S().pumpCount | 0));
    while (db.pumps.length < n) db.pumps.push(makePump(db.pumps.length + 1));
    while (db.pumps.length > n && db.pumps[db.pumps.length - 1].status === 'idle') db.pumps.pop();
  }
  ensurePumps();

  function audit(who, action, detail) {
    db.audit.push({ t: Date.now(), who, action, detail: clean(detail, 200) });
    if (db.audit.length > 3000) db.audit.splice(0, db.audit.length - 3000);
  }
  const grade = (id) => db.grades.find((g) => g.id === id);
  const product = (sku) => db.products.find((p) => p.sku === String(sku) || p.barcode === String(sku));
  const memberById = (id) => (id && db.members[id]) || null;
  const memberByAny = (q) => {
    const d = digits(q);
    if (!d) return null;
    return Object.values(db.members).find((m) => m.phone === d || m.card === d) || null;
  };
  const publicMember = (m) => m && { id: m.id, phone: m.phone, card: m.card, name: m.name, points: m.points, fuelSaverCpl: m.fuelSaverCpl || 0,
    pointsValueCents: Math.floor(m.points / S().ptsPerDollarRedeem) * 100 };
  const nextTxId = () => 'R' + String(++db.seq.tx).padStart(6, '0');
  const findTx = (id) => db.tx.find((t) => t.id === id);
  const openShift = (u) => db.shifts.find((s) => s.user === u && !s.closedAt);

  /* ---------- live updates ---------- */
  const clients = new Set();
  function broadcast(event, data) {
    const msg = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
    for (const c of clients) { try { c.write(msg); } catch (e) { clients.delete(c); } }
  }
  const pumpView = (p) => {
    const g = grade(p.grade);
    const m = memberById(p.memberId);
    return { ...p, gradeName: g ? g.name : null, member: m ? { name: m.name, phone: m.phone } : null };
  };
  let pumpsDirty = false;
  const pumpsChanged = () => { pumpsDirty = true; };
  function flushPumps() { if (!pumpsDirty) return; pumpsDirty = false; broadcast('pumps', db.pumps.map(pumpView)); store.save(); }

  /* ---------- pump engine ---------- */
  function resetPump(p) { const last = p.lastTxId; Object.assign(p, makePump(p.n), { lastTxId: last }); pumpsChanged(); }

  function authorizePump(p, o) {
    if (p.status !== 'idle') fail(409, 'pump_busy', 'Pump ' + p.n + ' is not free');
    if (o.grade && !grade(o.grade)) fail(400, 'bad_grade');
    Object.assign(p, { status: 'authorized', mode: o.mode, grade: o.grade || null, limitCents: o.limitCents || 0, memberId: o.memberId || null,
      paidCents: o.paidCents || 0, txId: o.txId || null, tender: o.tender || null, by: o.by || null, authAt: Date.now(), ml: 0, cents: 0 });
    pumpsChanged();
  }
  function startPump(p, gradeId) {
    if (p.status !== 'authorized') fail(409, 'not_authorized', 'Pump ' + p.n + ' has not been authorized');
    const g = grade(gradeId || p.grade || 'reg');
    if (!g) fail(400, 'bad_grade');
    if (p.grade && gradeId && p.grade !== gradeId) fail(409, 'grade_locked', 'This pump was authorized for ' + grade(p.grade).name);
    Object.assign(p, { status: 'fuelling', grade: g.id, startedAt: Date.now(), price: g.price });
    pumpsChanged();
  }
  function pointsForLitres(ml) { return Math.floor((ml / 1000) * S().ptsPerLitre); }
  function earn(m, pts) { if (m && pts > 0) m.points += pts; }

  function finishPump(p, reason) {
    if (p.status !== 'fuelling' && p.status !== 'authorized') return;
    const price = p.price || (grade(p.grade) || {}).price || 0;
    p.status = 'done'; p.endedAt = Date.now(); p.stopReason = reason;
    p.cents = fuelCents(p.ml, price);
    const m = memberById(p.memberId);
    p.discountCents = m && m.fuelSaverCpl ? Math.min(p.cents, Math.round((p.ml / 1000) * m.fuelSaverCpl)) : 0;
    const payable = p.cents - p.discountCents;
    const g = grade(p.grade);
    const fuelLine = { type: 'fuel', pump: p.n, grade: p.grade, gradeName: g ? g.name : '', ml: Math.round(p.ml), price, cents: p.cents, discountCents: p.discountCents, mode: p.mode };
    if (p.mode === 'prepay') {
      const tx = findTx(p.txId);
      if (tx) {
        const line = tx.lines.find((l) => l.type === 'prepay' && l.pump === p.n && !l.dispensed);
        if (line) line.dispensed = fuelLine;
        const pts = pointsForLitres(p.ml);
        if (m && pts) { earn(m, pts); tx.pointsEarned = (tx.pointsEarned || 0) + pts; }
      }
      p.refundCents = Math.max(0, p.paidCents - payable);
      if (!p.refundCents) resetPump(p);
    } else if (p.mode === 'postpay') {
      if (p.ml <= 0) resetPump(p); else p.owedCents = payable;
    } else { /* outdoor card or app: charge the held card for what was pumped */
      if (p.ml > 0) {
        const pts = pointsForLitres(p.ml);
        earn(m, pts);
        const tx = recordTx({ type: 'sale', source: p.mode, user: p.mode === 'app' ? 'app' : 'pump', shiftId: null, memberId: p.memberId,
          lines: [{ ...fuelLine, label: 'Pump ' + p.n + ' ' + fuelLine.gradeName, totalCents: payable }],
          subtotalCents: payable, addedTaxCents: 0, includedTaxCents: includedTax(payable, S().taxBp), totalCents: payable,
          tenders: [{ ...p.tender, type: 'card', cents: payable }], changeCents: 0, pointsEarned: pts, pointsRedeemed: 0 });
        p.lastTxId = tx.id;
      }
      resetPump(p);
    }
    pumpsChanged();
  }

  let lastTick = Date.now();
  function tick() {
    const now = Date.now(), dt = Math.min(2000, now - lastTick); lastTick = now;
    for (const p of db.pumps) {
      if (p.status !== 'fuelling') continue;
      const rate = (S().flowMlPerSec * S().simSpeed) / 1000;
      p.ml += rate * dt;
      p.cents = fuelCents(p.ml, p.price);
      if (p.limitCents && p.cents >= p.limitCents) {
        p.ml = Math.floor((p.limitCents * 10000) / p.price);
        p.cents = fuelCents(p.ml, p.price);
        finishPump(p, 'limit');
      } else if (p.ml >= 250000) finishPump(p, 'max');
      pumpsChanged();
    }
    flushPumps();
  }

  /* ---------- transactions ---------- */
  function recordTx(t) {
    const tx = { id: nextTxId(), time: Date.now(), ...t };
    db.tx.push(tx);
    store.save();
    broadcast('tx', { id: tx.id, totalCents: tx.totalCents, type: tx.type, source: tx.source });
    return tx;
  }

  /* price a cart: the single source of truth for totals (used by quote and by sale) */
  function priceCart(body, forSale) {
    const lines = Array.isArray(body.lines) ? body.lines.slice(0, 200) : [];
    const out = [];
    let subtotal = 0, taxable = 0, fuelIncl = 0, storeDollarsCents = 0, needsAge = false, postpayMl = 0;
    const member = body.memberId ? memberById(body.memberId) : null;
    if (body.memberId && !member) fail(400, 'no_member', 'That loyalty member was not found');
    const seenPumps = new Set();
    for (const l of lines) {
      if (l.type === 'item') {
        const p = product(l.sku);
        if (!p) fail(400, 'no_product', 'Unknown product ' + clean(l.sku, 20));
        const qty = int(l.qty);
        if (!(qty >= 1 && qty <= 999)) fail(400, 'bad_qty');
        const total = p.price * qty;
        out.push({ type: 'item', sku: p.sku, label: p.name, qty, unitCents: p.price, totalCents: total, taxable: p.taxable, age: p.age, wash: p.wash });
        subtotal += total; storeDollarsCents += total;
        if (p.taxable) taxable += total;
        if (p.age) needsAge = true;
      } else if (l.type === 'prepay') {
        const n = int(l.pump), cents = int(l.cents);
        const p = db.pumps[n - 1];
        if (!p) fail(400, 'bad_pump');
        if (seenPumps.has(n)) fail(400, 'dup_pump', 'Pump ' + n + ' is on this sale twice');
        seenPumps.add(n);
        if (p.status !== 'idle') fail(409, 'pump_busy', 'Pump ' + n + ' is not free');
        if (!(cents >= 100 && cents <= 50000)) fail(400, 'bad_amount', 'Prepay must be between $1 and $500');
        if (l.grade && !grade(l.grade)) fail(400, 'bad_grade');
        const g = grade(l.grade);
        out.push({ type: 'prepay', pump: n, grade: l.grade || null, label: 'Prepay pump ' + n + (g ? ' ' + g.name : ''), totalCents: cents });
        subtotal += cents; fuelIncl += cents;
      } else if (l.type === 'postpay') {
        const n = int(l.pump), p = db.pumps[n - 1];
        if (!p || p.status !== 'done' || p.mode !== 'postpay') fail(409, 'nothing_owed', 'Pump ' + n + ' has nothing to pay');
        if (seenPumps.has(n)) fail(400, 'dup_pump');
        seenPumps.add(n);
        const g = grade(p.grade);
        const pay = p.cents - p.discountCents;
        out.push({ type: 'fuel', pump: n, grade: p.grade, gradeName: g ? g.name : '', ml: Math.round(p.ml), price: p.price, cents: p.cents, discountCents: p.discountCents, mode: 'postpay',
          label: 'Pump ' + n + ' ' + (g ? g.name : '') + ' ' + (p.ml / 1000).toFixed(3) + ' L', totalCents: pay });
        subtotal += pay; fuelIncl += pay; postpayMl += p.ml;
      } else if (l.type === 'giftsell') {
        const cents = int(l.cents);
        if (!(cents >= 500 && cents <= 50000)) fail(400, 'bad_amount', 'Gift cards are $5 to $500');
        out.push({ type: 'giftsell', label: 'New gift card', totalCents: cents });
        subtotal += cents;
      } else if (l.type === 'giftload') {
        const cents = int(l.cents), card = digits(l.card);
        if (!db.giftcards[card]) fail(400, 'no_card', 'Gift card not found');
        if (!(cents >= 500 && cents <= 50000)) fail(400, 'bad_amount', 'Loads are $5 to $500');
        out.push({ type: 'giftload', card, label: 'Gift card load ****' + card.slice(-4), totalCents: cents });
        subtotal += cents;
      } else fail(400, 'bad_line');
    }
    const addedTax = Math.round((taxable * S().taxBp) / 10000);
    const total = subtotal + addedTax;
    const fuelSaving = out.reduce((a, l) => a + (l.discountCents || 0), 0);
    const ptsEarn = member ? Math.floor((storeDollarsCents / 100) * S().ptsPerDollar) + pointsForLitres(postpayMl) : 0;
    const res = { lines: out, subtotalCents: subtotal, addedTaxCents: addedTax, includedTaxCents: includedTax(fuelIncl, S().taxBp), totalCents: total,
      fuelSavingCents: fuelSaving, needsAge, member: publicMember(member), pointsEarn: ptsEarn };
    if (forSale && !out.length) fail(400, 'empty', 'The sale is empty');
    return res;
  }

  function checkTenders(body, q, member) {
    const tenders = Array.isArray(body.tenders) ? body.tenders.slice(0, 10) : [];
    const out = [];
    let paid = 0, cash = 0;
    const giftUse = {};
    for (const t of tenders) {
      const cents = int(t.cents);
      if (!(cents >= 0 && cents <= 1000000)) fail(400, 'bad_amount');
      if (t.type === 'cash') { out.push({ type: 'cash', cents }); cash += cents; }
      else if (t.type === 'card') {
        const brand = BRANDS.includes(t.brand) ? t.brand : 'Visa';
        out.push({ type: 'card', brand, last4: /^\d{4}$/.test(t.last4 || '') ? t.last4 : randDigits(4), method: t.method === 'insert' ? 'insert' : 'tap', auth: randDigits(6), cents });
      } else if (t.type === 'gift') {
        const card = digits(t.card), gc = db.giftcards[card];
        if (!gc) fail(400, 'no_card', 'Gift card not found');
        giftUse[card] = (giftUse[card] || 0) + cents;
        if (giftUse[card] > gc.balance) fail(400, 'low_balance', 'Gift card balance is only ' + money(gc.balance));
        out.push({ type: 'gift', card, cents });
      } else if (t.type === 'points') {
        if (!member) fail(400, 'no_member', 'Add a loyalty member to redeem points');
        if (cents % 100) fail(400, 'bad_amount', 'Points are redeemed in whole dollars');
        const pts = (cents / 100) * S().ptsPerDollarRedeem;
        if (pts > member.points) fail(400, 'low_points', 'Not enough points');
        out.push({ type: 'points', cents, points: pts });
      } else fail(400, 'bad_tender');
      paid += cents;
    }
    if (paid < q.totalCents) fail(400, 'short', 'Still owing ' + money(q.totalCents - paid));
    const change = paid - q.totalCents;
    if (change > cash) fail(400, 'overpaid', 'Only cash can be over the total');
    if (out.some((t) => t.type === 'card' && t.cents === 0)) fail(400, 'bad_amount');
    return { tenders: out, changeCents: change };
  }

  function sale(body, user) {
    const shift = openShift(user.username);
    if (!shift) fail(409, 'no_shift', 'Open your shift (count your float) before selling');
    const q = priceCart(body, true);
    if (q.needsAge && body.ageChecked !== true) fail(400, 'age_check', 'Check ID: this sale has age-restricted items (' + S().ageLimit + '+)');
    const member = q.member ? db.members[q.member.id] : null;
    const { tenders, changeCents } = checkTenders(body, q, member);
    /* effects, all validated above */
    const tx = recordTx({ type: 'sale', source: 'counter', user: user.username, shiftId: shift.id, memberId: member ? member.id : null,
      lines: q.lines, subtotalCents: q.subtotalCents, addedTaxCents: q.addedTaxCents, includedTaxCents: q.includedTaxCents, totalCents: q.totalCents,
      tenders, changeCents, pointsEarned: 0, pointsRedeemed: 0, ageChecked: q.needsAge || undefined });
    for (const l of tx.lines) {
      if (l.type === 'item') {
        const p = product(l.sku); p.stock -= l.qty;
        if (l.wash) l.washCodes = Array.from({ length: l.qty }, () => randDigits(5));
      } else if (l.type === 'prepay') {
        authorizePump(db.pumps[l.pump - 1], { mode: 'prepay', grade: l.grade, limitCents: l.totalCents, paidCents: l.totalCents, txId: tx.id, memberId: tx.memberId, by: user.username });
      } else if (l.type === 'fuel') resetPump(db.pumps[l.pump - 1]);
      else if (l.type === 'giftsell') {
        let card; do card = '6060' + randDigits(12); while (db.giftcards[card]);
        db.giftcards[card] = { card, balance: l.totalCents, created: Date.now(), history: [{ t: Date.now(), cents: l.totalCents, tx: tx.id }] };
        l.card = card; l.label = 'New gift card ****' + card.slice(-4);
      } else if (l.type === 'giftload') {
        const gc = db.giftcards[l.card]; gc.balance += l.totalCents; gc.history.push({ t: Date.now(), cents: l.totalCents, tx: tx.id });
      }
    }
    for (const t of tenders) {
      if (t.type === 'gift') { const gc = db.giftcards[t.card]; gc.balance -= t.cents; gc.history.push({ t: Date.now(), cents: -t.cents, tx: tx.id }); }
      if (t.type === 'points') { member.points -= t.points; tx.pointsRedeemed += t.points; }
    }
    if (member) { earn(member, q.pointsEarn); tx.pointsEarned = q.pointsEarn; }
    if (q.needsAge) audit(user.username, 'age_check', tx.id + ' ID confirmed ' + S().ageLimit + '+');
    pumpsChanged(); flushPumps();
    return tx;
  }

  function cashNet(tx) {
    const cash = tx.tenders.filter((t) => t.type === 'cash').reduce((a, t) => a + t.cents, 0);
    return cash - (tx.changeCents || 0);
  }
  function refundTenders(tx) { /* what goes back, per original tender */
    const out = [];
    const cash = cashNet(tx);
    if (cash) out.push({ type: 'cash', cents: -cash });
    for (const t of tx.tenders) if (t.type !== 'cash') out.push({ ...t, cents: -t.cents, points: t.points ? -t.points : undefined });
    return out;
  }
  function applyRefundTenders(tenders, txId, member) {
    for (const t of tenders) {
      if (t.type === 'gift') { const gc = db.giftcards[t.card]; if (gc) { gc.balance -= t.cents; gc.history.push({ t: Date.now(), cents: -t.cents, tx: txId }); } }
      if (t.type === 'points' && member) member.points -= t.points;
    }
  }

  async function overrideOk(user, ov) {
    if (ROLES[user.role] >= ROLES.manager) return user.username;
    const u = ov && db.users[String(ov.username || '').toLowerCase()];
    if (!u || u.disabled || ROLES[u.role] < ROLES.manager || !(await checkPassword(ov.password || '', u.hash))) fail(403, 'override', 'A manager needs to approve this');
    return u.username;
  }

  async function refund(body, user) {
    const tx = findTx(String(body.txId || ''));
    if (!tx || tx.type !== 'sale') fail(404, 'no_tx', 'Sale not found');
    if (tx.refundedBy) fail(409, 'already', 'That sale was already refunded (' + tx.refundedBy + ')');
    if (tx.lines.some((l) => l.type === 'prepay')) fail(409, 'prepay', 'Prepaid fuel can not be refunded here. Use Refund change on the pump.');
    if (tx.lines.some((l) => l.type === 'giftsell' || l.type === 'giftload')) fail(409, 'gift', 'Gift card sales are final');
    const approver = await overrideOk(user, body.override);
    const shift = openShift(user.username);
    const tenders = refundTenders(tx);
    if (tenders.some((t) => t.type === 'cash') && !shift) fail(409, 'no_shift', 'Open your shift to give cash back');
    const member = memberById(tx.memberId);
    const r = recordTx({ type: 'refund', source: 'counter', refundOf: tx.id, user: user.username, approvedBy: approver, shiftId: shift ? shift.id : null,
      memberId: tx.memberId, reason: clean(body.reason, 120),
      lines: tx.lines.map((l) => ({ ...l, qty: l.qty ? -l.qty : undefined, totalCents: -l.totalCents })),
      subtotalCents: -tx.subtotalCents, addedTaxCents: -tx.addedTaxCents, includedTaxCents: -tx.includedTaxCents, totalCents: -tx.totalCents,
      tenders, changeCents: 0, pointsEarned: -(tx.pointsEarned || 0), pointsRedeemed: -(tx.pointsRedeemed || 0) });
    for (const l of tx.lines) if (l.type === 'item') { const p = product(l.sku); if (p) p.stock += l.qty; }
    applyRefundTenders(tenders, r.id, member);
    if (member) member.points = Math.max(0, member.points - (tx.pointsEarned || 0));
    tx.refundedBy = r.id;
    audit(user.username, 'refund', tx.id + ' ' + money(tx.totalCents) + ' approved by ' + approver);
    return r;
  }

  function refundChange(n, user) {
    const p = db.pumps[n - 1];
    if (!p || p.status !== 'done' || p.mode !== 'prepay' || !p.refundCents) fail(409, 'no_change', 'No change is owed on that pump');
    const tx = findTx(p.txId);
    const orig = tx ? tx.tenders : [];
    const card = orig.find((t) => t.type === 'card'), gift = orig.find((t) => t.type === 'gift');
    const back = card ? { ...card, cents: -p.refundCents } : gift ? { ...gift, cents: -p.refundCents } : { type: 'cash', cents: -p.refundCents };
    const shift = openShift(user.username);
    if (back.type === 'cash' && !shift) fail(409, 'no_shift', 'Open your shift to give cash back');
    const r = recordTx({ type: 'refund', source: 'counter', refundOf: p.txId, user: user.username, shiftId: shift ? shift.id : null, memberId: p.memberId,
      reason: 'Prepay change pump ' + n, lines: [{ type: 'prepaychange', pump: n, label: 'Prepay change pump ' + n, totalCents: -p.refundCents }],
      subtotalCents: -p.refundCents, addedTaxCents: 0, includedTaxCents: -includedTax(p.refundCents, S().taxBp), totalCents: -p.refundCents,
      tenders: [back], changeCents: 0, pointsEarned: 0, pointsRedeemed: 0 });
    applyRefundTenders([back], r.id, null);
    resetPump(p); flushPumps();
    return r;
  }

  /* ---------- shifts ---------- */
  function shiftReport(s) {
    const txs = db.tx.filter((t) => t.shiftId === s.id);
    const cashSales = txs.reduce((a, t) => a + cashNet(t), 0);
    const drops = (s.drops || []).reduce((a, d) => a + d.cents, 0);
    const payouts = (s.payouts || []).reduce((a, d) => a + d.cents, 0);
    const expected = s.floatCents + cashSales - drops - payouts;
    return { ...s, txCount: txs.length, salesCents: txs.reduce((a, t) => a + t.totalCents, 0), cashSalesCents: cashSales, dropsCents: drops, payoutsCents: payouts,
      expectedCents: expected, overShortCents: s.countedCents == null ? null : s.countedCents - expected };
  }

  /* ---------- reports ---------- */
  function dayReport(day) {
    const txs = db.tx.filter((t) => localDay(t.time) === day);
    const r = { day, sales: 0, refunds: 0, grossCents: 0, refundCents: 0, netCents: 0, taxCents: 0, fuel: {}, items: {}, tenders: {}, hours: Array(24).fill(0),
      pointsIssued: 0, pointsRedeemed: 0, bySource: {} };
    for (const t of txs) {
      if (t.type === 'sale') { r.sales++; r.grossCents += t.totalCents; } else { r.refunds++; r.refundCents += t.totalCents; }
      r.netCents += t.totalCents; r.taxCents += t.addedTaxCents + t.includedTaxCents;
      r.pointsIssued += t.pointsEarned || 0; r.pointsRedeemed += t.pointsRedeemed || 0;
      r.hours[Number(hourFmt.format(new Date(t.time))) % 24] += t.totalCents;
      r.bySource[t.source] = (r.bySource[t.source] || 0) + t.totalCents;
      const sign = t.type === 'refund' ? -1 : 1;
      for (const l of t.lines) {
        const f = l.type === 'fuel' ? l : l.type === 'prepay' ? l.dispensed : null;
        if (f) { const k = f.gradeName || f.grade; r.fuel[k] = r.fuel[k] || { ml: 0, cents: 0 }; r.fuel[k].ml += sign * f.ml; r.fuel[k].cents += sign * (f.cents - (f.discountCents || 0)); }
        if (l.type === 'item') { r.items[l.label] = r.items[l.label] || { qty: 0, cents: 0 }; r.items[l.label].qty += l.qty; r.items[l.label].cents += l.totalCents; }
      }
      const tn = t.type === 'sale' ? [...t.tenders.filter((x) => x.type !== 'cash'), { type: 'cash', cents: cashNet(t) }] : t.tenders;
      for (const x of tn) if (x.cents) { const k = x.type === 'card' ? x.brand : x.type; r.tenders[k] = (r.tenders[k] || 0) + x.cents; }
    }
    return r;
  }

  /* ---------- sessions ---------- */
  const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  const cookie = (name, val, maxAge) => name + '=' + val + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + (cfg.cookieSecure ? '; Secure' : '');
  function newSession(bag, id, days) {
    const tok = crypto.randomBytes(32).toString('hex');
    bag[tok] = { id, exp: Date.now() + days * 864e5 };
    for (const [k, s] of Object.entries(bag)) if (s.exp < Date.now()) delete bag[k];
    store.save();
    return tok;
  }
  function staff(req) {
    const s = db.sessions[cookies(req).hl_s];
    if (!s || s.exp < Date.now()) return null;
    const u = db.users[s.id];
    return u && !u.disabled ? u : null;
  }
  function appMember(req) {
    const s = db.appSessions[cookies(req).hl_m];
    if (!s || s.exp < Date.now()) return null;
    return db.members[s.id] || null;
  }
  const publicUser = (u) => ({ username: u.username, name: u.name, role: u.role, disabled: !!u.disabled });
  const tries = new Map();
  function rateLimit(req) {
    const ip = req.socket.remoteAddress || '';
    const t = tries.get(ip) || { n: 0, reset: Date.now() + 600000 };
    if (t.reset < Date.now()) { t.n = 0; t.reset = Date.now() + 600000; }
    if (++t.n > 20) fail(429, 'slow_down', 'Too many sign-in attempts. Wait a few minutes.');
    tries.set(ip, t);
  }

  function newMember(phone, name) {
    const ph = digits(phone);
    if (ph.length !== 10) fail(400, 'bad_phone', 'Enter a 10-digit phone number');
    if (memberByAny(ph)) fail(409, 'exists', 'That phone number is already a member');
    const id = 'M' + String(++db.seq.member).padStart(6, '0');
    let card; do card = '7010' + randDigits(12); while (memberByAny(card));
    db.members[id] = { id, phone: ph, card, name: clean(name, 40) || 'Member', points: 0, fuelSaverCpl: 0, wallet: [], created: Date.now() };
    store.save();
    return db.members[id];
  }

  /* ---------- routes ---------- */
  const routes = [];
  const route = (method, pattern, opts, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), opts, fn });
  const STAFF = { auth: 'staff' }, MGR = { auth: 'staff', role: 'manager' }, OWNER = { auth: 'staff', role: 'owner' }, APP = { auth: 'app' }, PUB = {};
  const pumpArg = (params) => { const p = db.pumps[int(params.n) - 1]; if (!p) fail(404, 'bad_pump'); return p; };

  route('GET', '/api/hello', PUB, () => ({ version: VERSION, setup: !Object.keys(db.users).length, storeName: S().storeName }));
  route('POST', '/api/setup', PUB, async (b, ctx) => {
    if (Object.keys(db.users).length) fail(409, 'done', 'Setup is already done');
    const username = String(b.username || '').toLowerCase().trim();
    if (!/^[a-z0-9._-]{2,30}$/.test(username)) fail(400, 'bad_user', 'Usernames are 2-30 letters, numbers, dots or dashes');
    if (String(b.password || '').length < 6) fail(400, 'bad_pw', 'Owner password must be at least 6 characters');
    db.users[username] = { username, name: clean(b.name, 40) || username, role: 'owner', hash: await hashPassword(b.password), created: Date.now() };
    if (b.storeName) S().storeName = clean(b.storeName, 60);
    audit(username, 'setup', 'owner created');
    ctx.setCookie(cookie('hl_s', newSession(db.sessions, username, 1), 86400));
    return { user: publicUser(db.users[username]) };
  });
  route('POST', '/api/login', PUB, async (b, ctx) => {
    rateLimit(ctx.req);
    const u = db.users[String(b.username || '').toLowerCase().trim()];
    const ok = await checkPassword(b.password || '', u && u.hash);
    if (!u || !ok || u.disabled) fail(401, 'bad_login', 'Wrong username or PIN');
    ctx.setCookie(cookie('hl_s', newSession(db.sessions, u.username, 1), 86400));
    audit(u.username, 'login', '');
    return { user: publicUser(u) };
  });
  route('POST', '/api/logout', PUB, (b, ctx) => { delete db.sessions[cookies(ctx.req).hl_s]; store.save(); ctx.setCookie(cookie('hl_s', '', 0)); return { ok: true }; });

  route('GET', '/api/bootstrap', STAFF, (b, { user }) => ({
    me: publicUser(user), version: VERSION, settings: S(), grades: db.grades, products: db.products, pumps: db.pumps.map(pumpView),
    shift: (() => { const s = openShift(user.username); return s ? shiftReport(s) : null; })(), brands: BRANDS,
  }));
  route('POST', '/api/quote', STAFF, (b) => priceCart(b, false));
  route('POST', '/api/sale', STAFF, (b, { user }) => sale(b, user));
  route('POST', '/api/refund', STAFF, (b, { user }) => refund(b, user));
  route('GET', '/api/tx', STAFF, (b, { url, user }) => {
    const day = url.searchParams.get('day') || localDay(Date.now());
    let list = db.tx.filter((t) => localDay(t.time) === day);
    if (ROLES[user.role] < ROLES.manager) list = list.filter((t) => t.user === user.username || t.source !== 'counter');
    return { day, tx: list.slice(-500).reverse() };
  });
  route('GET', '/api/tx/:id', STAFF, (b, { params }) => { const t = findTx(params.id); if (!t) fail(404, 'no_tx'); return { tx: t, member: publicMember(memberById(t.memberId)) }; });

  /* pumps */
  route('POST', '/api/pumps/:n/authorize', STAFF, (b, { params, user }) => {
    const p = pumpArg(params);
    const m = b.memberId ? memberById(b.memberId) : null;
    authorizePump(p, { mode: 'postpay', grade: b.grade || null, memberId: m ? m.id : null, by: user.username });
    flushPumps(); return pumpView(p);
  });
  route('POST', '/api/pumps/:n/stop', STAFF, (b, { params, user }) => {
    const p = pumpArg(params);
    if (p.status === 'authorized' && p.mode === 'postpay') { resetPump(p); audit(user.username, 'deauthorize', 'pump ' + p.n); }
    else finishPump(p, 'cashier');
    flushPumps(); return pumpView(p);
  });
  route('POST', '/api/pumps/stop-all', STAFF, (b, { user }) => {
    for (const p of db.pumps) if (p.status === 'fuelling' || p.status === 'authorized') finishPump(p, 'emergency');
    audit(user.username, 'emergency_stop', 'all pumps');
    flushPumps(); return { ok: true };
  });
  route('POST', '/api/pumps/:n/refund-change', STAFF, (b, { params, user }) => refundChange(int(params.n), user));

  /* forecourt simulator: plays the customer standing at the pump */
  route('POST', '/api/sim/pumps/:n/card', STAFF, (b, { params }) => {
    const p = pumpArg(params);
    const m = b.member ? memberByAny(b.member) : null;
    if (b.member && !m) fail(400, 'no_member', 'No member with that phone or card');
    authorizePump(p, { mode: 'outdoor', grade: b.grade || null, limitCents: S().outdoorPreauthCents, memberId: m ? m.id : null,
      tender: { brand: BRANDS.includes(b.brand) ? b.brand : 'Visa', last4: randDigits(4), method: 'tap', auth: randDigits(6) } });
    flushPumps(); return pumpView(p);
  });
  route('POST', '/api/sim/pumps/:n/lift', STAFF, (b, { params }) => { const p = pumpArg(params); startPump(p, b.grade); flushPumps(); return pumpView(p); });
  route('POST', '/api/sim/pumps/:n/hangup', STAFF, (b, { params }) => { const p = pumpArg(params); finishPump(p, 'nozzle'); flushPumps(); return pumpView(p); });

  /* loyalty + gift cards at the counter */
  route('GET', '/api/members', STAFF, (b, { url }) => {
    const q = String(url.searchParams.get('q') || '').toLowerCase();
    const d = digits(q);
    const list = Object.values(db.members).filter((m) => !q || (d && (m.phone.includes(d) || m.card.includes(d))) || m.name.toLowerCase().includes(q));
    return { members: list.slice(0, 50).map(publicMember) };
  });
  route('POST', '/api/members', STAFF, (b, { user }) => { const m = newMember(b.phone, b.name); audit(user.username, 'member_new', m.id); return publicMember(m); });
  route('PUT', '/api/members/:id', MGR, (b, { params, user }) => {
    const m = memberById(params.id); if (!m) fail(404, 'no_member');
    if (b.name != null) m.name = clean(b.name, 40) || m.name;
    if (b.fuelSaverCpl != null) { const c = int(b.fuelSaverCpl); if (!(c >= 0 && c <= 20)) fail(400, 'bad_amount', 'Fuel saver is 0 to 20 cents per litre'); m.fuelSaverCpl = c; }
    if (b.addPoints != null) { const a = int(b.addPoints); if (!Number.isFinite(a) || Math.abs(a) > 1e6) fail(400, 'bad_amount'); m.points = Math.max(0, m.points + a); audit(user.username, 'points_adjust', m.id + ' ' + a); }
    store.save(); return publicMember(m);
  });
  route('GET', '/api/giftcards/:card', STAFF, (b, { params }) => { const g = db.giftcards[digits(params.card)]; if (!g) fail(404, 'no_card', 'Gift card not found'); return g; });
  route('GET', '/api/giftcards', MGR, () => ({ cards: Object.values(db.giftcards).map((g) => ({ card: g.card, balance: g.balance, created: g.created })) }));

  /* shifts */
  route('POST', '/api/shift/open', STAFF, (b, { user }) => {
    if (openShift(user.username)) fail(409, 'open', 'Your shift is already open');
    const f = int(b.floatCents); if (!(f >= 0 && f <= 200000)) fail(400, 'bad_amount');
    const s = { id: 'S' + String(++db.seq.shift).padStart(5, '0'), user: user.username, openedAt: Date.now(), floatCents: f, drops: [], payouts: [] };
    db.shifts.push(s); store.save(); return shiftReport(s);
  });
  route('POST', '/api/shift/drop', STAFF, (b, { user }) => {
    const s = openShift(user.username); if (!s) fail(409, 'no_shift');
    const c = int(b.cents); if (!(c > 0 && c <= 1000000)) fail(400, 'bad_amount');
    s.drops.push({ t: Date.now(), cents: c }); store.save(); return shiftReport(s);
  });
  route('POST', '/api/shift/payout', STAFF, async (b, { user }) => {
    const s = openShift(user.username); if (!s) fail(409, 'no_shift');
    const c = int(b.cents); if (!(c > 0 && c <= 100000)) fail(400, 'bad_amount');
    const approver = await overrideOk(user, b.override);
    s.payouts.push({ t: Date.now(), cents: c, reason: clean(b.reason, 80), approvedBy: approver });
    audit(user.username, 'payout', money(c) + ' ' + clean(b.reason, 80));
    store.save(); return shiftReport(s);
  });
  route('POST', '/api/shift/close', STAFF, (b, { user }) => {
    const s = openShift(user.username); if (!s) fail(409, 'no_shift');
    const c = int(b.countedCents); if (!(c >= 0 && c <= 5000000)) fail(400, 'bad_amount');
    s.countedCents = c; s.closedAt = Date.now();
    const r = shiftReport(s);
    audit(user.username, 'shift_close', s.id + ' over/short ' + money(r.overShortCents));
    store.save(); return r;
  });
  route('GET', '/api/shifts', MGR, () => ({ shifts: db.shifts.slice(-100).reverse().map(shiftReport) }));

  /* back office */
  route('GET', '/api/reports/day', MGR, (b, { url }) => dayReport(url.searchParams.get('day') || localDay(Date.now())));
  route('PUT', '/api/grades', MGR, (b, { user }) => {
    const list = Array.isArray(b.grades) ? b.grades : [];
    for (const x of list) {
      const g = grade(x.id); if (!g) continue;
      const pr = int(x.price); if (!(pr >= 500 && pr <= 5000)) fail(400, 'bad_price', 'Prices are 50.0 to 500.0 cents per litre');
      if (pr !== g.price) audit(user.username, 'price', g.name + ' ' + (g.price / 10).toFixed(1) + ' -> ' + (pr / 10).toFixed(1));
      g.price = pr;
      if (x.name) g.name = clean(x.name, 20);
    }
    store.save(); broadcast('grades', db.grades); return { grades: db.grades };
  });
  route('POST', '/api/products', MGR, (b, { user }) => {
    const sku = clean(b.sku, 20); if (!sku || product(sku)) fail(400, 'bad_sku', 'Pick a new, unused item code');
    const p = { sku, barcode: digits(b.barcode).slice(0, 14) || '', name: '', cat: '', price: 0, taxable: true, age: false, wash: false, stock: 0 };
    db.products.push(p); applyProduct(p, b); audit(user.username, 'product_new', sku); store.save(); return p;
  });
  route('PUT', '/api/products/:sku', MGR, (b, { params }) => { const p = db.products.find((x) => x.sku === params.sku); if (!p) fail(404, 'no_product'); applyProduct(p, b); store.save(); return p; });
  route('DELETE', '/api/products/:sku', MGR, (b, { params, user }) => {
    const i = db.products.findIndex((x) => x.sku === params.sku); if (i < 0) fail(404, 'no_product');
    db.products.splice(i, 1); audit(user.username, 'product_delete', params.sku); store.save(); return { ok: true };
  });
  route('POST', '/api/products/:sku/stock', STAFF, (b, { params, user }) => {
    const p = db.products.find((x) => x.sku === params.sku); if (!p) fail(404, 'no_product');
    const d = int(b.delta); if (!(Math.abs(d) >= 1 && Math.abs(d) <= 100000)) fail(400, 'bad_qty');
    p.stock += d; audit(user.username, 'stock', p.sku + ' ' + (d > 0 ? '+' : '') + d + ' ' + clean(b.reason, 60)); store.save(); return p;
  });
  function applyProduct(p, b) {
    if (b.name != null) { p.name = clean(b.name, 40); if (!p.name) fail(400, 'bad_name', 'Items need a name'); }
    if (b.cat != null) p.cat = clean(b.cat, 20) || 'Other';
    if (b.price != null) { const c = int(b.price); if (!(c >= 0 && c <= 100000)) fail(400, 'bad_price'); p.price = c; }
    if (b.barcode != null) p.barcode = digits(b.barcode).slice(0, 14);
    for (const k of ['taxable', 'age', 'wash']) if (b[k] != null) p[k] = !!b[k];
    if (b.stock != null) { const s = int(b.stock); if (Number.isFinite(s)) p.stock = s; }
  }
  route('GET', '/api/users', MGR, () => ({ users: Object.values(db.users).map(publicUser) }));
  route('POST', '/api/users', MGR, async (b, { user }) => {
    const username = String(b.username || '').toLowerCase().trim();
    if (!/^[a-z0-9._-]{2,30}$/.test(username) || db.users[username]) fail(400, 'bad_user', 'Pick a new username (2-30 letters or numbers)');
    const role = ROLES[b.role] ? b.role : 'cashier';
    if (ROLES[role] >= ROLES[user.role] && user.role !== 'owner') fail(403, 'role', 'You can only add staff below your own role');
    if (String(b.password || '').length < 4) fail(400, 'bad_pw', 'PINs and passwords need at least 4 characters');
    db.users[username] = { username, name: clean(b.name, 40) || username, role, hash: await hashPassword(b.password), created: Date.now() };
    audit(user.username, 'user_new', username + ' ' + role); store.save(); return publicUser(db.users[username]);
  });
  route('PUT', '/api/users/:u', MGR, async (b, { params, user }) => {
    const u = db.users[params.u]; if (!u) fail(404, 'no_user');
    if (user.role !== 'owner' && ROLES[u.role] >= ROLES[user.role]) fail(403, 'role', 'Only the owner can change that account');
    if (b.role && ROLES[b.role]) {
      if (user.role !== 'owner') fail(403, 'role', 'Only the owner can change roles');
      if (u.role === 'owner' && b.role !== 'owner' && Object.values(db.users).filter((x) => x.role === 'owner' && !x.disabled).length < 2) fail(409, 'last_owner', 'Keep at least one owner');
      u.role = b.role;
    }
    if (b.name != null) u.name = clean(b.name, 40) || u.name;
    if (b.password) { if (String(b.password).length < 4) fail(400, 'bad_pw'); u.hash = await hashPassword(b.password); }
    if (b.disabled != null) {
      if (u.username === user.username) fail(409, 'self', 'You can not turn off your own account');
      u.disabled = !!b.disabled;
      if (u.disabled) for (const [k, s] of Object.entries(db.sessions)) if (s.id === u.username) delete db.sessions[k];
    }
    audit(user.username, 'user_edit', u.username); store.save(); return publicUser(u);
  });
  route('PUT', '/api/settings', MGR, (b, { user }) => {
    const s = S();
    const nums = { taxBp: [0, 3000], pumpCount: [1, 24], ptsPerLitre: [0, 100], ptsPerDollar: [0, 100], ptsPerDollarRedeem: [100, 100000],
      flowMlPerSec: [100, 2000], simSpeed: [1, 20], outdoorPreauthCents: [2500, 50000], ageLimit: [18, 21] };
    for (const [k, [lo, hi]] of Object.entries(nums)) if (b[k] != null) { const v = int(b[k]); if (!(v >= lo && v <= hi)) fail(400, 'bad_setting', k + ' must be ' + lo + ' to ' + hi); s[k] = v; }
    for (const k of ['storeName', 'address', 'footer']) if (b[k] != null) s[k] = clean(b[k], k === 'footer' ? 120 : 80);
    ensurePumps(); pumpsChanged(); flushPumps();
    audit(user.username, 'settings', Object.keys(b).join(','));
    store.save(); broadcast('settings', s); return s;
  });
  route('GET', '/api/audit', MGR, () => ({ audit: db.audit.slice(-300).reverse() }));
  route('GET', '/api/live', STAFF, (b, ctx) => {
    const { res } = ctx;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('event: pumps\ndata: ' + JSON.stringify(db.pumps.map(pumpView)) + '\n\n');
    clients.add(res);
    const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* closed */ } }, 25000);
    ctx.req.on('close', () => { clients.delete(res); clearInterval(hb); });
    return ctx.STREAM;
  });

  /* customer phone app */
  route('POST', '/api/app/signup', PUB, async (b, ctx) => {
    rateLimit(ctx.req);
    if (!/^\d{4}$/.test(String(b.pin || ''))) fail(400, 'bad_pin', 'Pick a 4-digit PIN');
    let m = memberByAny(b.phone);
    if (m && m.pinHash) fail(409, 'exists', 'That number already has the app. Sign in instead.');
    if (!m) m = newMember(b.phone, b.name);
    else if (b.name) m.name = clean(b.name, 40) || m.name; /* simulation: a counter-created member can claim the app */
    m.pinHash = await hashPassword(b.pin);
    ctx.setCookie(cookie('hl_m', newSession(db.appSessions, m.id, 90), 90 * 86400));
    return { member: publicMember(m) };
  });
  route('POST', '/api/app/login', PUB, async (b, ctx) => {
    rateLimit(ctx.req);
    const m = memberByAny(b.phone);
    const ok = await checkPassword(String(b.pin || ''), m && m.pinHash);
    if (!m || !ok) fail(401, 'bad_login', 'Wrong phone number or PIN');
    ctx.setCookie(cookie('hl_m', newSession(db.appSessions, m.id, 90), 90 * 86400));
    return { member: publicMember(m) };
  });
  route('POST', '/api/app/logout', PUB, (b, ctx) => { delete db.appSessions[cookies(ctx.req).hl_m]; store.save(); ctx.setCookie(cookie('hl_m', '', 0)); return { ok: true }; });
  route('GET', '/api/app/me', APP, (b, { member }) => {
    const active = db.pumps.find((p) => p.mode === 'app' && p.memberId === member.id && p.status !== 'idle');
    return {
      member: publicMember(member), wallet: member.wallet || [], storeName: S().storeName, grades: db.grades,
      pumps: db.pumps.map((p) => ({ n: p.n, free: p.status === 'idle' })), active: active ? pumpView(active) : null,
      history: db.tx.filter((t) => t.memberId === member.id).slice(-25).reverse(), redeemEach: S().ptsPerDollarRedeem, earnPerLitre: S().ptsPerLitre, earnPerDollar: S().ptsPerDollar,
    };
  });
  route('POST', '/api/app/wallet', APP, (b, { member }) => {
    member.wallet = member.wallet || [];
    if (b.remove) { member.wallet = member.wallet.filter((w) => w.id !== b.remove); store.save(); return { wallet: member.wallet }; }
    if (member.wallet.length >= 4) fail(400, 'full', 'Up to 4 cards');
    member.wallet.push({ id: crypto.randomBytes(6).toString('hex'), brand: BRANDS.includes(b.brand) ? b.brand : 'Visa', last4: randDigits(4) });
    store.save(); return { wallet: member.wallet };
  });
  route('POST', '/api/app/pay', APP, (b, { member }) => {
    if (db.pumps.some((p) => p.mode === 'app' && p.memberId === member.id && p.status !== 'idle')) fail(409, 'active', 'You already have a pump going');
    const p = db.pumps[int(b.pump) - 1]; if (!p) fail(400, 'bad_pump', 'Pick a pump');
    const w = (member.wallet || []).find((x) => x.id === b.card); if (!w) fail(400, 'no_card', 'Add a card first');
    const max = int(b.maxCents); if (!(max >= 500 && max <= S().outdoorPreauthCents)) fail(400, 'bad_amount', 'Pick $5 to ' + money(S().outdoorPreauthCents));
    authorizePump(p, { mode: 'app', grade: b.grade || null, limitCents: max, memberId: member.id, tender: { brand: w.brand, last4: w.last4, method: 'app', auth: randDigits(6) } });
    flushPumps(); return pumpView(p);
  });
  const myPump = (member) => { const p = db.pumps.find((x) => x.mode === 'app' && x.memberId === member.id && x.status !== 'idle'); if (!p) fail(409, 'no_pump', 'No pump is active'); return p; };
  route('POST', '/api/app/lift', APP, (b, { member }) => { const p = myPump(member); startPump(p, b.grade); flushPumps(); return pumpView(p); });
  route('POST', '/api/app/stop', APP, (b, { member }) => { const p = myPump(member); finishPump(p, 'app'); flushPumps(); return { ok: true }; });

  /* ---------- http ---------- */
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
  const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'" };
  const STREAM = Symbol('stream');

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > 256 * 1024) { reject(new ApiError(413, 'too_big')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { if (!size) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new ApiError(400, 'bad_json')); } });
      req.on('error', reject);
    });
  }
  function serveStatic(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    if (rel === '/app') rel = '/app.html';
    if (rel === '/forecourt') rel = '/forecourt.html';
    const file = path.normalize(path.join(cfg.publicDir, rel));
    if (!file.startsWith(cfg.publicDir + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      res.writeHead(200, { ...SEC, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, url.pathname);
    }
    const headers = { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    const setCookies = [];
    try {
      let match = null;
      for (const r of routes) { if (r.method !== req.method) continue; const m = r.re.exec(url.pathname); if (m) { match = { r, params: m.groups || {} }; break; } }
      if (!match) fail(404, 'not_found');
      /* only JSON posts: blocks plain cross-site form posts */
      if (req.method !== 'GET' && !/^application\/json/i.test(req.headers['content-type'] || '')) fail(415, 'json_only');
      const ctx = { req, res, url, params: match.params, STREAM, setCookie: (c) => setCookies.push(c) };
      const { opts } = match.r;
      if (opts.auth === 'staff') {
        ctx.user = staff(req);
        if (!ctx.user) fail(401, 'signed_out', 'Please sign in');
        if (opts.role && ROLES[ctx.user.role] < ROLES[opts.role]) fail(403, 'role', 'Your role can not do that');
      } else if (opts.auth === 'app') {
        ctx.member = appMember(req);
        if (!ctx.member) fail(401, 'signed_out', 'Please sign in');
      }
      const body = req.method === 'GET' ? {} : await readBody(req);
      const out = await match.r.fn(body, ctx);
      if (out === STREAM) return;
      store.save();
      if (setCookies.length) headers['Set-Cookie'] = setCookies;
      res.writeHead(200, headers); res.end(JSON.stringify(out));
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 500;
      if (status === 500) console.error(e);
      if (setCookies.length) headers['Set-Cookie'] = setCookies;
      res.writeHead(status, headers);
      res.end(JSON.stringify({ error: e.code || 'server', message: status === 500 ? 'Something went wrong' : e.message }));
    }
  });

  /* a restart stops anything that was pumping */
  for (const p of db.pumps) if (p.status === 'fuelling') finishPump(p, 'restart');
  const timer = setInterval(tick, cfg.tickMs); timer.unref();
  const backupTimer = setInterval(() => store.backup(), 6 * 3600e3); backupTimer.unref();
  function close() { clearInterval(timer); clearInterval(backupTimer); for (const c of clients) { try { c.end(); } catch (e) { /* */ } } store.flush(); return new Promise((r) => server.close(r)); }
  return { server, store, tick, close, cfg };
}

if (require.main === module) {
  const cfg = loadConfig();
  const app = create(cfg);
  app.server.listen(cfg.port, cfg.host, () => { if (!cfg.quiet) console.log('Harbourline POS ' + VERSION + ' on http://' + cfg.host + ':' + cfg.port); });
  const stop = () => { app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}

module.exports = { create, loadConfig, fuelCents, includedTax };
