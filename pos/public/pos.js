'use strict';
/* Harbourline POS — cashier screen, journal and back office. */
const { $, $$, esc, money, litres, cpl, when, time, phone, toCents, api, toast, modal, confirmBox, askMoney, receiptHTML, printReceipt } = HL;
const st = {
  me: null, settings: {}, grades: [], products: [], pumps: [], shift: null, brands: [],
  cart: [], memberId: null, quote: null, tenders: [], ageOk: false, cat: 'All', view: 'sell', boTab: 'dash', live: false,
};
const root = $('#root');
const isMgr = () => !!st.me && (st.me.role === 'manager' || st.me.role === 'owner');
const gradeName = (id) => (st.grades.find((g) => g.id === id) || {}).name || '';
let es = null;

/* ---------------- start, setup, sign-in ---------------- */
async function start() {
  let hello;
  try { hello = await api('GET', '/api/hello'); }
  catch (e) { root.innerHTML = '<div class="center"><div class="card">Can not reach the Harbourline server. <button id="retry">Try again</button></div></div>'; $('#retry').onclick = start; return; }
  if (hello.setup) return showSetup(hello);
  try { await load(); showMain(); }
  catch (e) { if (e.status === 401) showLogin(hello); else root.innerHTML = '<div class="center">' + esc(e.message) + '</div>'; }
}
async function load() {
  const b = await api('GET', '/api/bootstrap');
  Object.assign(st, { me: b.me, settings: b.settings, grades: b.grades, products: b.products, pumps: b.pumps, shift: b.shift, brands: b.brands, version: b.version });
  document.title = b.settings.storeName + ' · POS';
}
function signinShell(title, inner) {
  root.innerHTML = '<div class="center"><form class="card signin" autocomplete="off"><div class="logo"><img src="icon.svg" width="30" height="30" alt=""> Harbourline POS</div>'
    + '<h2>' + esc(title) + '</h2>' + inner + '<div class="err muted small" style="color:#fca5a5;min-height:18px;margin-top:8px"></div><button class="primary big" style="width:100%;margin-top:6px">Continue</button>'
    + '<p class="muted small" style="margin-top:14px">Simulation mode: no real cards or payments are processed.</p></form></div>';
  return $('form', root);
}
function showSetup() {
  const f = signinShell('Set up your store', '<p class="muted small">Create the owner account. You can add cashiers and managers after.</p>'
    + '<label>Store name</label><input name="storeName" value="Harbourline Fuel &amp; Market"><label>Your name</label><input name="name" required>'
    + '<label>Username</label><input name="username" required autocapitalize="off"><label>Password (6+ characters)</label><input name="password" type="password" required>');
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/setup', Object.fromEntries(new FormData(f))); await load(); showMain(); }
    catch (err) { $('.err', f).textContent = err.message; }
  };
}
function showLogin(hello) {
  const f = signinShell('Sign in · ' + hello.storeName, '<label>Username</label><input name="username" required autocapitalize="off"><label>PIN or password</label><input name="password" type="password" inputmode="numeric" required>');
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/login', Object.fromEntries(new FormData(f))); await load(); showMain(); }
    catch (err) { $('.err', f).textContent = err.message; }
  };
}

/* ---------------- main frame ---------------- */
function showMain() {
  root.innerHTML = '<div class="app"><div class="top">'
    + '<span class="logo"><img src="icon.svg" width="26" height="26" alt=""> <span id="storeName"></span></span>'
    + '<span class="who" id="who"></span><span id="shiftChip"></span><span id="liveChip"></span><span class="grow"></span>'
    + '<button data-view="sell">Sell</button><button data-view="journal">Journal</button>' + (isMgr() ? '<button data-view="bo">Back office</button>' : '')
    + '<button id="openFc" title="Play customers at the pumps">Forecourt sim</button><button id="openApp" title="The customer phone app">Customer app</button>'
    + '<span class="clock" id="clock"></span><button class="ghost" id="signout">Sign out</button></div><div id="view" class="scroll"></div></div>';
  $('#storeName').textContent = st.settings.storeName;
  $('#who').textContent = st.me.name + ' · ' + st.me.role;
  $$('[data-view]').forEach((b) => { b.onclick = () => { st.view = b.dataset.view; renderView(); }; });
  $('#openFc').onclick = () => window.open('/forecourt', 'hl-forecourt');
  $('#openApp').onclick = () => window.open('/app', 'hl-app', 'width=440,height=860');
  $('#signout').onclick = async () => {
    if (st.cart.length && !(await confirmBox('Sign out?', 'The current sale will be cleared.', 'Sign out', 'danger'))) return;
    if (es) es.close();
    await api('POST', '/api/logout').catch(() => {});
    location.reload();
  };
  const tickClock = () => { const c = $('#clock'); if (c) c.textContent = new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }); };
  tickClock(); setInterval(tickClock, 15000);
  renderShiftChip(); connectLive(); renderView();
}
function renderView() {
  $$('[data-view]').forEach((b) => b.classList.toggle('primary', b.dataset.view === st.view));
  if (st.view === 'sell') renderSell();
  else if (st.view === 'journal') renderJournal();
  else renderBackOffice();
}
function connectLive() {
  if (es) es.close();
  es = new EventSource('/api/live');
  es.addEventListener('pumps', (e) => {
    st.pumps = JSON.parse(e.data);
    if (st.view === 'sell') renderPumps();
    setLive(true);
  });
  es.addEventListener('grades', (e) => { st.grades = JSON.parse(e.data); if (st.view === 'sell') renderGrades(); });
  es.addEventListener('settings', (e) => { st.settings = JSON.parse(e.data); $('#storeName').textContent = st.settings.storeName; });
  es.onopen = () => setLive(true);
  es.onerror = () => setLive(false);
}
function setLive(on) {
  if (st.live === on) return;
  st.live = on;
  const c = $('#liveChip');
  if (c) c.innerHTML = on ? '' : '<span class="chip bad">Pumps offline — reconnecting</span>';
}

/* ---------------- shift ---------------- */
function renderShiftChip() {
  const c = $('#shiftChip'); if (!c) return;
  c.innerHTML = st.shift ? '<button class="chip ok" id="shiftBtn">Shift ' + esc(st.shift.id) + '</button>' : '<button class="chip warn" id="shiftBtn">Shift closed · open it</button>';
  $('#shiftBtn').onclick = st.shift ? shiftMenu : openShift;
}
async function openShift() {
  const f = await askMoney('Open shift: count your float', { note: 'Count the cash in your drawer before your first sale.', quick: [{ cents: 10000 }, { cents: 15000 }, { cents: 20000 }], min: 0 });
  if (f == null) return;
  try { st.shift = await api('POST', '/api/shift/open', { floatCents: f }); renderShiftChip(); toast('Shift open with ' + money(f) + ' float'); }
  catch (e) { toast(e.message, true); }
}
async function shiftMenu() {
  const s = await api('GET', '/api/bootstrap').then((b) => b.shift).catch(() => st.shift);
  st.shift = s; if (!s) return renderShiftChip();
  modal({
    title: 'Shift ' + s.id,
    html: '<table><tr><td>Opened</td><td class="right">' + when(s.openedAt) + '</td></tr><tr><td>Float</td><td class="right">' + money(s.floatCents) + '</td></tr>'
      + '<tr><td>Transactions</td><td class="right">' + s.txCount + '</td></tr><tr><td>Cash taken in</td><td class="right">' + money(s.cashSalesCents) + '</td></tr>'
      + '<tr><td>Safe drops</td><td class="right">' + money(s.dropsCents) + '</td></tr><tr><td>Paid outs</td><td class="right">' + money(s.payoutsCents) + '</td></tr>'
      + '<tr><td><b>Cash expected in drawer</b></td><td class="right"><b>' + money(s.expectedCents) + '</b></td></tr></table>',
    actions: [{ label: 'Close' }, { label: 'Safe drop', run: () => { safeDrop(); } }, { label: 'Paid out', run: () => { paidOut(); } },
      { label: 'Close shift', cls: 'danger', run: () => { closeShift(); } }],
  });
}
async function safeDrop() {
  if (!st.shift) return openShift();
  const c = await askMoney('Safe drop', { note: 'Cash moved from your drawer to the safe.', quick: [{ cents: 10000 }, { cents: 20000 }, { cents: 50000 }] });
  if (c == null) return;
  try { st.shift = await api('POST', '/api/shift/drop', { cents: c }); toast('Dropped ' + money(c) + ' to the safe'); } catch (e) { toast(e.message, true); }
}
function overrideFields() {
  return isMgr() ? '' : '<p class="muted small" style="margin-top:12px">Needs a manager:</p><label>Manager username</label><input name="ou" autocapitalize="off"><label>Manager PIN</label><input name="op" type="password">';
}
const overrideFrom = (box) => (isMgr() ? undefined : { username: $('[name=ou]', box).value, password: $('[name=op]', box).value });
function paidOut() {
  modal({ title: 'Paid out', html: '<label>Amount</label><input name="amt" inputmode="decimal" placeholder="0.00"><label>Reason (delivery, supplies…)</label><input name="why">' + overrideFields(),
    actions: [{ label: 'Cancel' }, { label: 'Pay out', cls: 'primary', run: async (box) => {
      const c = toCents($('[name=amt]', box).value); if (!(c > 0)) throw new Error('Enter an amount');
      st.shift = await api('POST', '/api/shift/payout', { cents: c, reason: $('[name=why]', box).value, override: overrideFrom(box) });
      toast('Paid out ' + money(c));
    } }] });
}
async function closeShift() {
  if (st.tenders.length) return toast('Finish the current sale first', true);
  const c = await askMoney('Close shift: count the drawer', { note: 'Count all cash in the drawer, including the float.', min: 0 });
  if (c == null) return;
  try {
    const r = await api('POST', '/api/shift/close', { countedCents: c });
    st.shift = null; renderShiftChip();
    const os = r.overShortCents;
    modal({ title: 'Shift ' + r.id + ' closed', html: '<table><tr><td>Expected</td><td class="right">' + money(r.expectedCents) + '</td></tr><tr><td>Counted</td><td class="right">' + money(r.countedCents)
      + '</td></tr><tr><td><b>' + (os === 0 ? 'Balanced' : os > 0 ? 'Over' : 'Short') + '</b></td><td class="right"><b>' + money(os) + '</b></td></tr><tr><td>Sales in shift</td><td class="right">' + money(r.salesCents) + ' (' + r.txCount + ')</td></tr></table>' });
  } catch (e) { toast(e.message, true); }
}

/* ---------------- sell screen ---------------- */
function renderSell() {
  $('#view').innerHTML = '<div class="main">'
    + '<div class="col"><div class="row"><h2 class="grow" style="margin:0">Pumps</h2><button class="danger" id="stopAll">Stop all pumps</button></div><div class="grade-pills" id="grades"></div><div class="pumps scroll" id="pumps"></div></div>'
    + '<div class="col"><input id="scan" placeholder="Scan a barcode or search items…" autocomplete="off"><div class="cats" id="cats"></div><div class="keys scroll" id="keys" style="flex:1"></div>'
    + '<div class="extras"><button data-x="giftsell">Sell gift card</button><button data-x="giftload">Load gift card</button><button data-x="giftbal">Gift card balance</button>'
    + '<button data-x="member">Harbour Points</button><button data-x="drop">Safe drop</button><button data-x="last">Last receipt</button></div></div>'
    + '<div class="col cartcol"><div class="card cart"><div id="memberBox"></div><div class="lines" id="lines"></div><div class="tot" id="tot"></div><div id="pay"></div></div></div></div>';
  $('#stopAll').onclick = async () => {
    if (!(await confirmBox('Emergency stop', 'Stop every pump right now?', 'Stop all pumps', 'danger'))) return;
    try { await api('POST', '/api/pumps/stop-all'); toast('All pumps stopped'); } catch (e) { toast(e.message, true); }
  };
  const scan = $('#scan');
  scan.oninput = () => renderKeys();
  scan.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    const v = scan.value.trim(); if (!v) return;
    const exact = st.products.find((p) => p.barcode === v || p.sku === v);
    const list = filtered();
    const p = exact || (list.length === 1 ? list[0] : null);
    if (p) { addItem(p.sku); scan.value = ''; renderKeys(); } else toast(list.length ? 'Pick one of the matching items' : 'No item matches "' + v + '"', !list.length);
  };
  $$('[data-x]').forEach((b) => { b.onclick = () => extra(b.dataset.x); });
  renderGrades(); renderPumps(); renderKeys(); renderCart();
}
function renderGrades() {
  const el = $('#grades'); if (!el) return;
  el.innerHTML = st.grades.map((g) => '<span class="grade-pill"><span class="dot" style="background:' + esc(g.color) + '"></span>' + esc(g.name) + (g.octane ? ' ' + esc(g.octane) : '') + ' <b>' + cpl(g.price) + '</b></span>').join('');
}
function pumpKind(p) { return p.status === 'done' ? (p.refundCents ? 'change' : 'owed') : p.status; }
function renderPumps() {
  const el = $('#pumps'); if (!el) return;
  el.innerHTML = st.pumps.map((p) => {
    const k = pumpKind(p);
    const inSale = st.cart.some((l) => l.pump === p.n);
    const label = { idle: 'Ready', authorized: 'Authorized', fuelling: 'Pumping', owed: 'Pay now', change: 'Change due' }[k];
    const amt = k === 'fuelling' ? money(p.cents) : k === 'owed' ? money(p.owedCents) : k === 'change' ? money(p.refundCents)
      : k === 'authorized' ? (p.paidCents ? 'Paid ' + money(p.paidCents) : p.limitCents ? 'Up to ' + money(p.limitCents) : 'Postpay') : '';
    const sub = p.ml > 0 ? litres(p.ml) + ' ' + esc(p.gradeName || '') : p.grade ? esc(p.gradeName) : '';
    const tag = p.mode ? { prepay: 'PREPAY', postpay: 'POSTPAY', outdoor: 'CARD', app: 'APP' }[p.mode] : '';
    return '<button class="pump ' + k + '" data-pump="' + p.n + '"><span class="n">' + p.n + '</span>' + (tag ? '<span class="tag">' + tag + '</span>' : '')
      + '<span class="st">' + label + (inSale ? ' · in sale' : '') + '</span><span class="l">' + sub + (p.member ? ' · ★ ' + esc(p.member.name) : '') + '</span><span class="amt">' + amt + '</span></button>';
  }).join('');
  $$('[data-pump]', el).forEach((b) => { b.onclick = () => pumpMenu(Number(b.dataset.pump)); });
}
function filtered() {
  const q = ($('#scan') ? $('#scan').value : '').trim().toLowerCase();
  return st.products.filter((p) => (st.cat === 'All' || p.cat === st.cat) && (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku === q));
}
function renderKeys() {
  const cats = ['All', ...new Set(st.products.map((p) => p.cat))];
  $('#cats').innerHTML = cats.map((c) => '<button class="' + (c === st.cat ? 'on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');
  $$('[data-cat]').forEach((b) => { b.onclick = () => { st.cat = b.dataset.cat; renderKeys(); }; });
  const list = filtered();
  $('#keys').innerHTML = list.map((p) => '<button class="key' + (p.stock < 5 && !p.wash ? ' low' : '') + '" data-sku="' + esc(p.sku) + '"><span>' + esc(p.name) + '</span>'
    + '<span class="row"><span class="p grow">' + money(p.price) + '</span>' + (p.age ? '<span class="f">' + st.settings.ageLimit + '+</span>' : '') + (p.wash ? '<span class="f">WASH</span>' : '') + (!p.taxable ? '<span class="f" style="color:#8b9ab3">no tax</span>' : '') + '</span></button>').join('')
    || '<div class="empty">No items match.</div>';
  $$('[data-sku]').forEach((b) => { b.onclick = () => addItem(b.dataset.sku); });
}

/* ---------------- cart ---------------- */
async function quote(cart, memberId = st.memberId) {
  if (!cart.length && !memberId) { st.cart = []; st.quote = null; st.memberId = null; renderCart(); renderPumps(); return true; }
  try {
    const q = await api('POST', '/api/quote', { lines: cart, memberId: memberId || undefined });
    st.cart = cart; st.quote = q; st.memberId = memberId;
    renderCart(); renderPumps();
    return true;
  } catch (e) { toast(e.message, true); return false; }
}
function locked() { if (st.tenders.length) { toast('Finish or cancel the payment first', true); return true; } return false; }
function addItem(sku) {
  if (locked()) return;
  const cart = st.cart.map((l) => ({ ...l }));
  const ex = cart.find((l) => l.type === 'item' && l.sku === sku);
  if (ex) ex.qty++; else cart.push({ type: 'item', sku, qty: 1 });
  return quote(cart);
}
function addLine(line) { if (locked()) return false; return quote([...st.cart, line]); }
function clearSale() { st.cart = []; st.quote = null; st.memberId = null; st.tenders = []; st.ageOk = false; renderCart(); renderPumps(); }

function renderCart() {
  const q = st.quote, paying = st.tenders.length > 0;
  const m = q && q.member;
  $('#memberBox').innerHTML = m
    ? '<div class="member"><span class="grow"><b>★ ' + esc(m.name) + '</b><br><span class="small muted">' + phone(m.phone) + ' · ' + m.points.toLocaleString() + ' pts (' + money(m.pointsValueCents) + ')' + (m.fuelSaverCpl ? ' · saves ' + m.fuelSaverCpl + '¢/L' : '') + '</span></span><button class="ghost" id="dropMember"' + (paying ? ' disabled' : '') + '>✕</button></div>'
    : '<button id="addMember" style="width:100%"' + (paying ? ' disabled' : '') + '>★ Add Harbour Points member</button>';
  if (m) $('#dropMember').onclick = () => quote(st.cart, null); else $('#addMember').onclick = memberFlow;
  if (!q || !q.lines.length) {
    $('#lines').innerHTML = '<div class="empty">Scan an item, tap a key, or tap a pump to start a sale.</div>';
    $('#tot').innerHTML = ''; $('#pay').innerHTML = '';
    return;
  }
  $('#lines').innerHTML = q.lines.map((l, i) => {
    let sub = '';
    if (l.type === 'item') sub = '<span class="q"><button data-dec="' + i + '"' + (paying ? ' disabled' : '') + '>−</button><span class="num">' + l.qty + '</span><button data-inc="' + i + '"' + (paying ? ' disabled' : '') + '>+</button><span class="muted small">× ' + money(l.unitCents) + (l.taxable ? ' · HST' : '') + '</span></span>';
    else if (l.type === 'fuel') sub = '<span class="muted small">' + litres(l.ml) + ' @ ' + cpl(l.price) + (l.discountCents ? ' · saved ' + money(l.discountCents) : '') + '</span>';
    else if (l.type === 'prepay') sub = '<span class="muted small">Pump unlocks after payment</span>';
    else sub = '<span class="muted small">Simulated card</span>';
    return '<div class="ln"><span>' + esc(l.label) + (l.age ? ' <span class="chip warn">' + st.settings.ageLimit + '+</span>' : '') + '</span><span class="num right"><b>' + money(l.totalCents) + '</b></span>'
      + sub + '<span class="right"><button class="ghost" data-del="' + i + '" title="Remove"' + (paying ? ' disabled' : '') + '>✕</button></span></div>';
  }).join('');
  $$('[data-inc]').forEach((b) => { b.onclick = () => { const c = st.cart.map((l) => ({ ...l })); c[b.dataset.inc].qty++; quote(c); }; });
  $$('[data-dec]').forEach((b) => { b.onclick = () => { const c = st.cart.map((l) => ({ ...l })); const l = c[b.dataset.dec]; if (l.qty > 1) l.qty--; else c.splice(b.dataset.dec, 1); quote(c); }; });
  $$('[data-del]').forEach((b) => { b.onclick = () => { const c = st.cart.slice(); c.splice(b.dataset.del, 1); quote(c); }; });

  const r = (a, b, cls = '') => '<div class="r ' + cls + '"><span>' + a + '</span><span>' + b + '</span></div>';
  $('#tot').innerHTML = r('Subtotal', money(q.subtotalCents)) + (q.fuelSavingCents ? r('Fuel saver', '−' + money(q.fuelSavingCents)) : '')
    + r('HST', money(q.addedTaxCents)) + r('<b>Total</b>', money(q.totalCents), 'big')
    + (q.includedTaxCents ? '<div class="muted small">Includes ' + money(q.includedTaxCents) + ' HST in fuel</div>' : '')
    + (m && q.pointsEarn ? '<div class="small" style="color:#5eead4">Earns ' + q.pointsEarn.toLocaleString() + ' points now' + (q.lines.some((l) => l.type === 'prepay') ? ' + more when fuel is pumped' : '') + '</div>' : '');
  renderPay();
}
const paidSoFar = () => st.tenders.reduce((a, t) => a + t.cents, 0);
const remaining = () => (st.quote ? st.quote.totalCents - paidSoFar() : 0);
function tenderName(t) { return t.type === 'card' ? t.brand + ' ' + t.method : t.type === 'gift' ? 'Gift ****' + t.card.slice(-4) : t.type === 'points' ? 'Points' : 'Cash'; }
function renderPay() {
  const left = remaining();
  const m = st.quote && st.quote.member;
  let h = '';
  if (st.tenders.length) {
    h += '<div class="card" style="padding:8px 10px;margin-top:8px">' + st.tenders.map((t) => '<div class="row"><span class="grow">' + esc(tenderName(t)) + '</span><span class="num">' + money(t.cents) + '</span></div>').join('')
      + '<div class="row" style="margin-top:4px"><b class="grow">Still owing</b><b class="num">' + money(Math.max(0, left)) + '</b></div></div>';
  }
  h += '<div class="paygrid"><button class="primary big" data-pay="cash">Cash</button><button class="primary big" data-pay="card">Card</button>'
    + '<button data-pay="gift">Gift card</button><button data-pay="points"' + (m && m.pointsValueCents >= 100 ? '' : ' disabled') + '>Use points</button>'
    + (left <= 0 ? '<button class="primary big" data-pay="done" style="grid-column:1/-1">Complete sale</button>' : '')
    + (st.tenders.length ? '<button class="danger" data-pay="cancel" style="grid-column:1/-1">Cancel payment</button>' : '<button class="ghost" data-pay="void" style="grid-column:1/-1">Void sale</button>') + '</div>';
  $('#pay').innerHTML = h;
  $$('[data-pay]').forEach((b) => { b.onclick = () => pay(b.dataset.pay); });
}

async function ensureAge() {
  if (!st.quote.needsAge || st.ageOk) return true;
  const d = new Date(); d.setFullYear(d.getFullYear() - st.settings.ageLimit);
  st.ageOk = await confirmBox('Check ID', '<p>This sale has age-restricted items. The customer must be <b>' + st.settings.ageLimit + ' or older</b>:</p><p style="font-size:18px">Born on or before <b>' + d.toLocaleDateString('en-CA', { dateStyle: 'long' }) + '</b></p>', 'ID checked');
  return st.ageOk;
}
async function pay(kind) {
  if (kind === 'void') { if (st.cart.length && await confirmBox('Void sale?', 'Remove everything from this sale.', 'Void', 'danger')) clearSale(); return; }
  if (kind === 'cancel') { st.tenders = []; toast('Payments cancelled (simulated reversal)'); return renderCart(); }
  if (!st.quote) return;
  if (!st.shift) { toast('Open your shift first', true); return openShift(); }
  if (kind === 'done') return finish();
  if (!(await ensureAge())) return;
  const left = remaining();
  if (kind === 'cash') {
    const quick = [{ cents: left, label: 'Exact' }];
    for (const bill of [500, 1000, 2000, 5000, 10000]) { const up = Math.ceil(left / bill) * bill; if (up > left && !quick.some((x) => x.cents === up)) quick.push({ cents: up }); }
    const c = await askMoney('Cash · owing ' + money(left), { quick: quick.slice(0, 6) });
    if (c != null) await addTender({ type: 'cash', cents: c });
  } else if (kind === 'card') cardTerminal(left);
  else if (kind === 'gift') giftTender(left);
  else if (kind === 'points') {
    const m = st.quote.member;
    const max = Math.min(m.pointsValueCents, Math.floor(left / 100) * 100);
    if (max < 100) return toast('Not enough left owing to use points', true);
    const each = st.settings.ptsPerDollarRedeem;
    const c = await askMoney('Use Harbour Points', { note: m.points.toLocaleString() + ' points. Every ' + each.toLocaleString() + ' points = $1. Whole dollars only.', quick: [{ cents: max, label: 'Max ' + money(max) }, ...[500, 1000, 2000].filter((x) => x < max).map((x) => ({ cents: x }))] });
    if (c == null) return;
    if (c % 100 || c > max) return toast('Points are used in whole dollars, up to ' + money(max), true);
    await addTender({ type: 'points', cents: c });
  }
}
function cardTerminal(left) {
  let method = 'tap';
  const box = modal({
    title: 'Card terminal (simulated)', sticky: true,
    html: '<label>Amount</label><input name="amt" inputmode="decimal" value="' + (left / 100).toFixed(2) + '"><label>Card brand</label><select name="brand">' + st.brands.map((b) => '<option>' + b + '</option>').join('') + '</select>'
      + '<label>How the customer pays</label><div class="row"><button data-m="tap" class="primary grow">Tap</button><button data-m="insert" class="grow">Insert chip + PIN</button></div>'
      + '<p class="muted small">You play the customer: approve or decline the card.</p>',
    actions: [{ label: 'Cancel' }, { label: 'Decline', cls: 'danger', run: () => { toast('Card declined (simulated)', true); } },
      { label: 'Approve', cls: 'primary', run: async (b) => {
        const c = toCents($('[name=amt]', b).value);
        if (!(c > 0 && c <= left)) throw new Error('Card amount must be up to ' + money(left));
        await addTender({ type: 'card', cents: c, brand: $('[name=brand]', b).value, method });
      } }],
  });
  $$('[data-m]', box).forEach((b) => { b.onclick = () => { method = b.dataset.m; $$('[data-m]', box).forEach((x) => x.classList.toggle('primary', x === b)); }; });
}
function giftTender(left) {
  modal({ title: 'Pay with gift card', html: '<label>Gift card number</label><input name="card" inputmode="numeric" placeholder="6060 …">',
    actions: [{ label: 'Cancel' }, { label: 'Check & use', cls: 'primary', run: async (b) => {
      const card = $('[name=card]', b).value.replace(/\D/g, '');
      const g = await api('GET', '/api/giftcards/' + card);
      const already = st.tenders.filter((t) => t.type === 'gift' && t.card === card).reduce((a, t) => a + t.cents, 0);
      const use = Math.min(g.balance - already, left);
      if (use <= 0) throw new Error('That card has no balance left');
      await addTender({ type: 'gift', card, cents: use });
      toast('Used ' + money(use) + ' · card has ' + money(g.balance - already - use) + ' left');
    } }] });
}
async function addTender(t) { st.tenders.push(t); if (remaining() <= 0) await finish(); else renderCart(); }
async function finish() {
  try {
    const tx = await api('POST', '/api/sale', { lines: st.cart, memberId: st.memberId || undefined, tenders: st.tenders, ageChecked: st.ageOk });
    clearSale();
    st.lastTx = tx.id;
    showReceipt(tx.id, true);
    api('GET', '/api/bootstrap').then((b) => { st.products = b.products; st.shift = b.shift; if (st.view === 'sell') renderKeys(); }).catch(() => {});
  } catch (e) {
    st.tenders = []; renderCart();
    toast(e.message + ' — payments reversed (simulated)', true);
    if (e.code === 'no_shift') openShift();
  }
}
async function showReceipt(id, fresh) {
  const { tx, member } = await api('GET', '/api/tx/' + id);
  const html = (fresh && tx.changeCents ? '<div class="card" style="text-align:center;margin-bottom:10px;background:#062523;border-color:#115e59"><div class="muted">Change due</div><div style="font-size:34px;font-weight:800">' + money(tx.changeCents) + '</div></div>' : '')
    + receiptHTML(tx, st.settings, member);
  const canRefund = tx.type === 'sale' && !tx.refundedBy && !tx.lines.some((l) => ['prepay', 'giftsell', 'giftload'].includes(l.type));
  modal({ title: (tx.type === 'refund' ? 'Refund ' : 'Receipt ') + tx.id, html,
    actions: [...(canRefund && !fresh ? [{ label: 'Refund', cls: 'danger', run: () => { refundFlow(tx); } }] : []),
      { label: 'Print', run: () => { printReceipt(receiptHTML(tx, st.settings, member)); return false; } }, { label: fresh ? 'Next customer' : 'Close', cls: 'primary' }] });
}
function refundFlow(tx) {
  modal({ title: 'Refund ' + tx.id + ' · ' + money(tx.totalCents), html: '<p class="muted small">Everything goes back the way it was paid. Stock and points are reversed.</p><label>Reason</label><input name="why" placeholder="Customer return">' + overrideFields(),
    actions: [{ label: 'Cancel' }, { label: 'Refund', cls: 'danger', run: async (box) => {
      const r = await api('POST', '/api/refund', { txId: tx.id, reason: $('[name=why]', box).value, override: overrideFrom(box) });
      toast('Refunded ' + money(-r.totalCents));
      showReceipt(r.id);
      if (st.view === 'journal') renderJournal();
    } }] });
}

/* ---------------- pumps ---------------- */
function pumpMenu(n) {
  const p = st.pumps[n - 1]; if (!p) return;
  const k = pumpKind(p);
  const acts = [{ label: 'Close' }];
  let html = '<p>' + ({ idle: 'Pump is free.', authorized: 'Waiting for the customer to lift the nozzle.', fuelling: 'Pumping now.', owed: 'Customer is coming in to pay.', change: 'Prepaid more than was pumped.' }[k]) + '</p>';
  if (p.ml > 0) html += '<p class="num">' + litres(p.ml) + ' ' + esc(p.gradeName || '') + ' · ' + money(p.cents) + (p.discountCents ? ' (fuel saver −' + money(p.discountCents) + ')' : '') + '</p>';
  if (p.member) html += '<p>★ ' + esc(p.member.name) + '</p>';
  if (k === 'idle') {
    acts.push({ label: 'Authorize (pay after)', run: async () => { await api('POST', '/api/pumps/' + n + '/authorize', { memberId: st.memberId || undefined }); toast('Pump ' + n + ' authorized'); } });
    acts.push({ label: 'Prepay…', cls: 'primary', run: () => { prepayFlow(n); } });
  } else if (k === 'authorized' || k === 'fuelling') {
    acts.push({ label: k === 'fuelling' ? 'Stop pump' : 'Cancel authorization', cls: 'danger', run: async () => { await api('POST', '/api/pumps/' + n + '/stop'); } });
  } else if (k === 'owed') {
    acts.push({ label: 'Add to sale · ' + money(p.owedCents), cls: 'primary', run: async () => { if (st.cart.some((l) => l.pump === n)) return; if (!(await addLine({ type: 'postpay', pump: n }))) return false; } });
  } else if (k === 'change') {
    acts.push({ label: 'Refund change · ' + money(p.refundCents), cls: 'primary', run: async () => { const r = await api('POST', '/api/pumps/' + n + '/refund-change'); showReceipt(r.id); } });
  }
  modal({ title: 'Pump ' + n, html, actions: acts });
}
function prepayFlow(n) {
  const quick = [2000, 4000, 6000, 8000, 10000];
  const box = modal({ title: 'Prepay pump ' + n,
    html: '<label>Grade</label><select name="grade"><option value="">Any grade</option>' + st.grades.map((g) => '<option value="' + g.id + '">' + esc(g.name) + ' · ' + cpl(g.price) + '</option>').join('') + '</select>'
      + '<label>Amount</label><input name="amt" inputmode="decimal" placeholder="0.00" style="font-size:22px;text-align:right"><div class="quick">' + quick.map((c) => '<button data-c="' + c + '">' + money(c) + '</button>').join('') + '</div>',
    actions: [{ label: 'Cancel' }, { label: 'Add to sale', cls: 'primary', run: async (b) => {
      const cents = toCents($('[name=amt]', b).value);
      if (!(cents >= 100)) throw new Error('Enter an amount');
      if (!(await addLine({ type: 'prepay', pump: n, cents, grade: $('[name=grade]', b).value || undefined }))) return false;
    } }] });
  $$('[data-c]', box).forEach((b) => { b.onclick = () => { $('[name=amt]', box).value = (Number(b.dataset.c) / 100).toFixed(2); $$('.actions .primary', box.parentNode)[0].click(); }; });
}

/* ---------------- extras ---------------- */
async function extra(x) {
  if (x === 'giftsell') { const c = await askMoney('Sell a gift card', { quick: [{ cents: 2500 }, { cents: 5000 }, { cents: 10000 }], min: 500 }); if (c != null) addLine({ type: 'giftsell', cents: c }); }
  else if (x === 'giftload' || x === 'giftbal') {
    modal({ title: x === 'giftload' ? 'Load a gift card' : 'Gift card balance', html: '<label>Gift card number</label><input name="card" inputmode="numeric">',
      actions: [{ label: 'Cancel' }, { label: 'Next', cls: 'primary', run: async (b) => {
        const card = $('[name=card]', b).value.replace(/\D/g, '');
        const g = await api('GET', '/api/giftcards/' + card);
        if (x === 'giftbal') { toast('Card ****' + card.slice(-4) + ' has ' + money(g.balance)); return; }
        b.close();
        const c = await askMoney('Load card ****' + card.slice(-4), { note: 'Current balance ' + money(g.balance), quick: [{ cents: 2500 }, { cents: 5000 }, { cents: 10000 }], min: 500 });
        if (c != null) addLine({ type: 'giftload', card, cents: c });
      } }] });
  } else if (x === 'member') memberFlow();
  else if (x === 'drop') safeDrop();
  else if (x === 'last') { if (st.lastTx) showReceipt(st.lastTx); else toast('No sale yet this session'); }
}
function memberFlow() {
  if (locked()) return;
  const box = modal({ title: 'Harbour Points', wide: true,
    html: '<label>Phone number, card number or name</label><input name="q" inputmode="search" autocomplete="off"><div id="mres" style="margin-top:10px"></div>'
      + '<details style="margin-top:12px"><summary class="muted">New member</summary><div class="row" style="margin-top:8px"><input name="nphone" placeholder="Phone (10 digits)" inputmode="tel"><input name="nname" placeholder="Name"><button id="mjoin" class="primary">Join</button></div></details>' });
  const res = $('#mres', box);
  let t;
  const search = async () => {
    const q = $('[name=q]', box).value.trim();
    if (!q) { res.innerHTML = ''; return; }
    const { members } = await api('GET', '/api/members?q=' + encodeURIComponent(q));
    res.innerHTML = members.length ? '<table>' + members.map((m) => '<tr class="click" data-m="' + m.id + '"><td>★ ' + esc(m.name) + '</td><td>' + phone(m.phone) + '</td><td class="right">' + m.points.toLocaleString() + ' pts</td></tr>').join('') + '</table>' : '<p class="muted">No member found. Add them below.</p>';
    $$('[data-m]', res).forEach((r) => { r.onclick = async () => { if (await quote(st.cart, r.dataset.m)) box.close(); }; });
  };
  $('[name=q]', box).oninput = () => { clearTimeout(t); t = setTimeout(() => search().catch((e) => box.error(e.message)), 200); };
  $('#mjoin', box).onclick = async () => {
    try {
      const m = await api('POST', '/api/members', { phone: $('[name=nphone]', box).value, name: $('[name=nname]', box).value });
      box.close(); toast('Welcome to Harbour Points, ' + m.name + '!');
      await quote(st.cart, m.id);
    } catch (e) { box.error(e.message); }
  };
}
/* ---------------- journal ---------------- */
async function renderJournal(day) {
  const v = $('#view');
  day = day || (v.dataset.day) || new Date().toLocaleDateString('en-CA');
  v.dataset.day = day;
  v.innerHTML = '<div class="bo"><div class="row"><h2 class="grow" style="margin:0">Journal</h2><input type="date" id="jday" value="' + day + '" style="width:auto"></div><div class="card" id="jlist">Loading…</div></div>';
  $('#jday').onchange = (e) => renderJournal(e.target.value);
  try {
    const { tx } = await api('GET', '/api/tx?day=' + day);
    $('#jlist').innerHTML = tx.length ? '<table><tr><th>Time</th><th>Receipt</th><th>Type</th><th>Where</th><th>By</th><th>Paid with</th><th class="right">Total</th></tr>'
      + tx.map((t) => '<tr class="click" data-tx="' + t.id + '"><td>' + time(t.time) + '</td><td>' + t.id + '</td><td>' + (t.type === 'refund' ? '<span class="chip bad">Refund</span>' : t.refundedBy ? '<span class="chip warn">Refunded</span>' : 'Sale') + '</td>'
        + '<td>' + ({ counter: 'Counter', outdoor: 'Pump card', app: 'App' }[t.source] || t.source) + '</td><td>' + esc(t.user) + '</td><td class="small">' + esc(t.tenders.map(tenderName).join(', ')) + '</td><td class="right num">' + money(t.totalCents) + '</td></tr>').join('') + '</table>'
      : '<div class="empty">No transactions on this day.</div>';
    $$('[data-tx]').forEach((r) => { r.onclick = () => showReceipt(r.dataset.tx); });
  } catch (e) { $('#jlist').textContent = e.message; }
}

/* ---------------- back office ---------------- */
const BO_TABS = [['dash', 'Dashboard'], ['fuel', 'Fuel prices'], ['items', 'Items & stock'], ['members', 'Members'], ['gift', 'Gift cards'], ['staff', 'Staff'], ['shifts', 'Shifts'], ['settings', 'Settings'], ['audit', 'Activity']];
function renderBackOffice() {
  if (!isMgr()) { st.view = 'sell'; return renderView(); }
  $('#view').innerHTML = '<div class="bo"><div class="tabs">' + BO_TABS.map(([k, l]) => '<button data-tab="' + k + '" class="' + (st.boTab === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div><div id="boBody"></div></div>';
  $$('[data-tab]').forEach((b) => { b.onclick = () => { st.boTab = b.dataset.tab; renderBackOffice(); }; });
  const fn = { dash: boDash, fuel: boFuel, items: boItems, members: boMembers, gift: boGift, staff: boStaff, shifts: boShifts, settings: boSettings, audit: boAudit }[st.boTab];
  fn().catch((e) => { $('#boBody').innerHTML = '<div class="card">' + esc(e.message) + '</div>'; });
}
const tbl = (head, rows) => '<table><tr>' + head.map((h) => '<th' + (h.startsWith('>') ? ' class="right"' : '') + '>' + h.replace(/^>/, '') + '</th>').join('') + '</tr>' + rows.join('') + '</table>';
async function boDash(day) {
  day = day || new Date().toLocaleDateString('en-CA');
  const r = await api('GET', '/api/reports/day?day=' + day);
  const fuelMl = Object.values(r.fuel).reduce((a, f) => a + f.ml, 0);
  const maxH = Math.max(1, ...r.hours);
  const items = Object.entries(r.items).sort((a, b) => b[1].cents - a[1].cents).slice(0, 10);
  $('#boBody').innerHTML = '<div class="row" style="margin-bottom:10px"><h2 class="grow" style="margin:0">Day summary</h2><input type="date" id="dday" value="' + day + '" style="width:auto"></div>'
    + '<div class="stats">' + [['Net sales', money(r.netCents)], ['Sales / refunds', r.sales + ' / ' + r.refunds], ['Fuel pumped', litres(fuelMl)], ['HST collected', money(r.taxCents)], ['Points issued', r.pointsIssued.toLocaleString()], ['Points redeemed', r.pointsRedeemed.toLocaleString()]]
      .map(([k, v]) => '<div class="card stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>').join('') + '</div>'
    + '<div class="grid2" style="margin-top:12px">'
    + '<div class="card"><h3>Fuel by grade</h3>' + tbl(['Grade', '>Litres', '>Sales'], Object.entries(r.fuel).map(([k, f]) => '<tr><td>' + esc(k) + '</td><td class="right num">' + litres(f.ml) + '</td><td class="right num">' + money(f.cents) + '</td></tr>')) + '</div>'
    + '<div class="card"><h3>Payments</h3>' + tbl(['Type', '>Amount'], Object.entries(r.tenders).map(([k, c]) => '<tr><td>' + esc({ cash: 'Cash', gift: 'Gift cards', points: 'Harbour Points' }[k] || k) + '</td><td class="right num">' + money(c) + '</td></tr>')) + '</div>'
    + '<div class="card"><h3>Top items</h3>' + tbl(['Item', '>Qty', '>Sales'], items.map(([k, i]) => '<tr><td>' + esc(k) + '</td><td class="right">' + i.qty + '</td><td class="right num">' + money(i.cents) + '</td></tr>')) + '</div>'
    + '<div class="card"><h3>Where sales happened</h3>' + tbl(['Channel', '>Amount'], Object.entries(r.bySource).map(([k, c]) => '<tr><td>' + ({ counter: 'Counter', outdoor: 'Pay at pump', app: 'Mobile app' }[k] || esc(k)) + '</td><td class="right num">' + money(c) + '</td></tr>')) + '</div>'
    + '</div><div class="card" style="margin-top:12px"><h3>Sales by hour</h3><div class="bars">' + r.hours.map((c) => '<div title="' + money(c) + '" style="height:' + Math.max(0, (c / maxH) * 100) + '%"></div>').join('') + '</div>'
    + '<div class="bars-x">' + r.hours.map((_, i) => '<span>' + (i % 3 ? '' : i) + '</span>').join('') + '</div></div>';
  $('#dday').onchange = (e) => boDash(e.target.value);
}
async function boFuel() {
  $('#boBody').innerHTML = '<div class="card" style="max-width:640px"><h2>Fuel prices</h2><p class="muted small">Posted price per litre, HST included. Pumps pick up a new price on their next sale.</p>'
    + tbl(['Grade', 'Name', '>Price (¢/L)'], st.grades.map((g) => '<tr><td><span class="dot" style="background:' + esc(g.color) + '"></span> ' + esc(g.octane || '—') + '</td><td><input data-gn="' + g.id + '" value="' + esc(g.name) + '"></td><td class="right"><input data-gp="' + g.id + '" value="' + (g.price / 10).toFixed(1) + '" inputmode="decimal" style="width:110px;text-align:right"></td></tr>'))
    + '<div class="actions" style="display:flex;justify-content:flex-end;margin-top:12px"><button class="primary" id="saveFuel">Save prices</button></div></div>';
  $('#saveFuel').onclick = async () => {
    try {
      const grades = st.grades.map((g) => ({ id: g.id, name: $('[data-gn="' + g.id + '"]').value, price: Math.round(Number($('[data-gp="' + g.id + '"]').value) * 10) }));
      st.grades = (await api('PUT', '/api/grades', { grades })).grades; toast('Prices updated');
    } catch (e) { toast(e.message, true); }
  };
}
async function boItems() {
  const b = await api('GET', '/api/bootstrap'); st.products = b.products;
  const body = $('#boBody');
  body.innerHTML = '<div class="card"><div class="row" style="margin-bottom:10px"><h2 class="grow" style="margin:0">Items & stock</h2><input id="isearch" placeholder="Search" style="width:220px"><button class="primary" id="newItem">Add item</button></div><div id="itbl"></div></div>';
  const draw = () => {
    const q = $('#isearch').value.toLowerCase();
    $('#itbl').innerHTML = tbl(['Code', 'Name', 'Category', '>Price', 'Flags', '>Stock', ''], st.products.filter((p) => !q || (p.name + p.cat + p.sku + p.barcode).toLowerCase().includes(q)).map((p) =>
      '<tr><td>' + esc(p.sku) + '<br><span class="muted small">' + esc(p.barcode) + '</span></td><td>' + esc(p.name) + '</td><td>' + esc(p.cat) + '</td><td class="right num">' + money(p.price) + '</td><td class="small">'
      + [p.taxable ? 'HST' : 'no tax', p.age ? st.settings.ageLimit + '+' : '', p.wash ? 'wash' : ''].filter(Boolean).join(' · ') + '</td><td class="right num"' + (p.stock < 5 && !p.wash ? ' style="color:#fca5a5"' : '') + '>' + p.stock + '</td>'
      + '<td class="right"><button data-stock="' + esc(p.sku) + '">Stock</button> <button data-edit="' + esc(p.sku) + '">Edit</button></td></tr>'));
    $$('[data-edit]').forEach((x) => { x.onclick = () => itemEditor(st.products.find((p) => p.sku === x.dataset.edit)); });
    $$('[data-stock]').forEach((x) => { x.onclick = () => stockAdjust(st.products.find((p) => p.sku === x.dataset.stock)); });
  };
  $('#isearch').oninput = draw; $('#newItem').onclick = () => itemEditor(null); draw();
}
function itemEditor(p) {
  const v = p || { sku: '', barcode: '', name: '', cat: '', price: 0, taxable: true, age: false, wash: false, stock: 0 };
  modal({ title: p ? 'Edit ' + p.name : 'New item',
    html: '<div class="row"><div class="grow"><label>Item code</label><input name="sku" value="' + esc(v.sku) + '"' + (p ? ' disabled' : '') + '></div><div class="grow"><label>Barcode</label><input name="barcode" value="' + esc(v.barcode) + '"></div></div>'
      + '<label>Name</label><input name="name" value="' + esc(v.name) + '"><div class="row"><div class="grow"><label>Category</label><input name="cat" value="' + esc(v.cat) + '" list="cats"></div><div class="grow"><label>Price</label><input name="price" value="' + (v.price / 100).toFixed(2) + '" inputmode="decimal"></div><div class="grow"><label>Stock</label><input name="stock" value="' + v.stock + '" inputmode="numeric"' + (p ? ' disabled' : '') + '></div></div>'
      + '<datalist id="cats">' + [...new Set(st.products.map((x) => x.cat))].map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist>'
      + '<label class="check"><input type="checkbox" name="taxable"' + (v.taxable ? ' checked' : '') + '> Charge HST</label><label class="check"><input type="checkbox" name="age"' + (v.age ? ' checked' : '') + '> Age restricted (' + st.settings.ageLimit + '+)</label><label class="check"><input type="checkbox" name="wash"' + (v.wash ? ' checked' : '') + '> Car wash (prints a wash code)</label>',
    actions: [...(p ? [{ label: 'Delete', cls: 'danger', run: async () => { if (!(await confirmBox('Delete ' + p.name + '?', 'Past sales keep their records.', 'Delete', 'danger'))) return false; await api('DELETE', '/api/products/' + encodeURIComponent(p.sku)); boItems(); } }] : []),
      { label: 'Cancel' }, { label: 'Save', cls: 'primary', run: async (b) => {
        const g = (n) => $('[name=' + n + ']', b);
        const body = { name: g('name').value, cat: g('cat').value, barcode: g('barcode').value, price: toCents(g('price').value), taxable: g('taxable').checked, age: g('age').checked, wash: g('wash').checked };
        if (p) await api('PUT', '/api/products/' + encodeURIComponent(p.sku), body);
        else await api('POST', '/api/products', { ...body, sku: g('sku').value, stock: Number(g('stock').value) || 0 });
        toast('Saved'); boItems();
      } }] });
}
function stockAdjust(p) {
  modal({ title: 'Stock · ' + p.name, html: '<p class="muted">On hand: <b>' + p.stock + '</b></p><label>Change (+ received, − damaged/count fix)</label><input name="d" inputmode="numeric" placeholder="+24"><label>Reason</label><input name="why" placeholder="Delivery">',
    actions: [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', run: async (b) => { await api('POST', '/api/products/' + encodeURIComponent(p.sku) + '/stock', { delta: Number($('[name=d]', b).value), reason: $('[name=why]', b).value }); toast('Stock updated'); boItems(); } }] });
}
async function boMembers() {
  $('#boBody').innerHTML = '<div class="card"><div class="row" style="margin-bottom:10px"><h2 class="grow" style="margin:0">Harbour Points members</h2><input id="msearch" placeholder="Phone or name" style="width:240px"></div><div id="mtbl"></div></div>';
  const draw = async () => {
    const { members } = await api('GET', '/api/members?q=' + encodeURIComponent($('#msearch').value));
    $('#mtbl').innerHTML = tbl(['Name', 'Phone', 'Card', '>Points', '>Worth', '>Fuel saver'], members.map((m) => '<tr class="click" data-m="' + m.id + '"><td>★ ' + esc(m.name) + '</td><td>' + phone(m.phone) + '</td><td class="small muted">' + m.card + '</td><td class="right num">' + m.points.toLocaleString() + '</td><td class="right num">' + money(m.pointsValueCents) + '</td><td class="right">' + (m.fuelSaverCpl ? m.fuelSaverCpl + '¢/L' : '—') + '</td></tr>'));
    $$('[data-m]').forEach((r) => { r.onclick = () => memberEditor(members.find((m) => m.id === r.dataset.m), draw); });
  };
  let t; $('#msearch').oninput = () => { clearTimeout(t); t = setTimeout(draw, 200); };
  await draw();
}
function memberEditor(m, after) {
  modal({ title: '★ ' + m.name, html: '<p class="muted">' + phone(m.phone) + ' · ' + m.points.toLocaleString() + ' points</p><label>Name</label><input name="name" value="' + esc(m.name) + '">'
    + '<label>Fuel saver discount (¢ off every litre, 0 = none)</label><input name="fs" value="' + m.fuelSaverCpl + '" inputmode="numeric"><label>Add or remove points (e.g. 500 or −500)</label><input name="pts" placeholder="0" inputmode="numeric">',
    actions: [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', run: async (b) => {
      await api('PUT', '/api/members/' + m.id, { name: $('[name=name]', b).value, fuelSaverCpl: Number($('[name=fs]', b).value) || 0, addPoints: Number(($('[name=pts]', b).value || '0').replace('−', '-')) || 0 });
      toast('Member saved'); after();
    } }] });
}
async function boGift() {
  const { cards } = await api('GET', '/api/giftcards');
  $('#boBody').innerHTML = '<div class="card"><h2>Gift cards</h2><p class="muted small">Sell and load gift cards from the Sell screen.</p>'
    + tbl(['Card', 'Issued', '>Balance'], cards.slice().reverse().map((g) => '<tr><td class="num">' + g.card.replace(/(\d{4})(?=\d)/g, '$1 ') + '</td><td>' + when(g.created) + '</td><td class="right num">' + money(g.balance) + '</td></tr>'))
    + '<p class="muted" style="margin-top:10px">Outstanding balance: <b>' + money(cards.reduce((a, g) => a + g.balance, 0)) + '</b></p></div>';
}
async function boStaff() {
  const { users } = await api('GET', '/api/users');
  $('#boBody').innerHTML = '<div class="card" style="max-width:760px"><div class="row" style="margin-bottom:10px"><h2 class="grow" style="margin:0">Staff</h2><button class="primary" id="newUser">Add staff</button></div>'
    + tbl(['Name', 'Username', 'Role', ''], users.map((u) => '<tr class="click" data-u="' + esc(u.username) + '"><td>' + esc(u.name) + '</td><td>' + esc(u.username) + '</td><td>' + u.role + '</td><td>' + (u.disabled ? '<span class="chip bad">Off</span>' : '') + '</td></tr>')) + '</div>';
  $('#newUser').onclick = () => userEditor(null);
  $$('[data-u]').forEach((r) => { r.onclick = () => userEditor(users.find((u) => u.username === r.dataset.u)); });
}
function userEditor(u) {
  const owner = st.me.role === 'owner';
  const roles = owner ? ['cashier', 'manager', 'owner'] : ['cashier'];
  modal({ title: u ? u.name : 'Add staff',
    html: (u ? '' : '<label>Username</label><input name="username" autocapitalize="off">') + '<label>Name</label><input name="name" value="' + esc(u ? u.name : '') + '">'
      + '<label>Role</label><select name="role"' + (u && !owner ? ' disabled' : '') + '>' + roles.map((r) => '<option' + (u && u.role === r ? ' selected' : '') + '>' + r + '</option>').join('') + (u && !roles.includes(u.role) ? '<option selected>' + u.role + '</option>' : '') + '</select>'
      + '<label>' + (u ? 'New PIN or password (leave blank to keep)' : 'PIN or password (4+ characters)') + '</label><input name="password" type="password" inputmode="numeric">'
      + (u ? '<label class="check" style="margin-top:12px"><input type="checkbox" name="disabled"' + (u.disabled ? ' checked' : '') + '> Account turned off</label>' : ''),
    actions: [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', run: async (b) => {
      const g = (n) => $('[name=' + n + ']', b);
      if (u) {
        const body = { name: g('name').value, password: g('password').value || undefined, disabled: g('disabled').checked };
        if (owner) body.role = g('role').value;
        await api('PUT', '/api/users/' + encodeURIComponent(u.username), body);
      } else await api('POST', '/api/users', { username: g('username').value, name: g('name').value, role: g('role').value, password: g('password').value });
      toast('Saved'); boStaff();
    } }] });
}
async function boShifts() {
  const { shifts } = await api('GET', '/api/shifts');
  $('#boBody').innerHTML = '<div class="card"><h2>Shifts</h2>' + tbl(['Shift', 'Cashier', 'Opened', 'Closed', '>Float', '>Sales', '>Expected', '>Counted', '>Over/short'], shifts.map((s) =>
    '<tr><td>' + s.id + '</td><td>' + esc(s.user) + '</td><td>' + when(s.openedAt) + '</td><td>' + (s.closedAt ? when(s.closedAt) : '<span class="chip ok">Open</span>') + '</td><td class="right num">' + money(s.floatCents)
    + '</td><td class="right num">' + money(s.salesCents) + '</td><td class="right num">' + money(s.expectedCents) + '</td><td class="right num">' + (s.countedCents == null ? '—' : money(s.countedCents)) + '</td><td class="right num"'
    + (s.overShortCents ? ' style="color:' + (s.overShortCents < 0 ? '#fca5a5' : '#fde68a') + '"' : '') + '>' + (s.overShortCents == null ? '—' : money(s.overShortCents)) + '</td></tr>')) + '</div>';
}
async function boSettings() {
  const s = st.settings;
  const f = (k, label, v, extra = '') => '<label>' + label + '</label><input name="' + k + '" value="' + esc(v) + '" ' + extra + '>';
  $('#boBody').innerHTML = '<div class="grid2"><div class="card"><h2>Store</h2>' + f('storeName', 'Store name', s.storeName) + f('address', 'Address (on receipts)', s.address) + f('footer', 'Receipt message', s.footer)
    + f('taxBp', 'HST rate (%)', (s.taxBp / 100).toString(), 'inputmode="decimal"') + f('ageLimit', 'Age for restricted items', s.ageLimit, 'inputmode="numeric"') + '</div>'
    + '<div class="card"><h2>Harbour Points</h2>' + f('ptsPerLitre', 'Points per litre of fuel', s.ptsPerLitre) + f('ptsPerDollar', 'Points per $1 in store', s.ptsPerDollar) + f('ptsPerDollarRedeem', 'Points needed for $1 off', s.ptsPerDollarRedeem)
    + '<h2 style="margin-top:16px">Forecourt</h2>' + f('pumpCount', 'Number of pumps', s.pumpCount) + f('outdoorPreauthCents', 'Pay-at-pump hold ($)', (s.outdoorPreauthCents / 100).toFixed(2))
    + f('flowMlPerSec', 'Pump flow (mL per second)', s.flowMlPerSec) + f('simSpeed', 'Simulation speed (1 = real time)', s.simSpeed) + '</div></div>'
    + '<div class="row" style="justify-content:flex-end"><span class="muted small grow">Harbourline POS ' + esc(st.version || '') + '</span><button class="primary" id="saveSet">Save settings</button></div>';
  $('#saveSet').onclick = async () => {
    const g = (n) => $('[name=' + n + ']').value;
    try {
      st.settings = await api('PUT', '/api/settings', { storeName: g('storeName'), address: g('address'), footer: g('footer'), taxBp: Math.round(Number(g('taxBp')) * 100), ageLimit: Number(g('ageLimit')),
        ptsPerLitre: Number(g('ptsPerLitre')), ptsPerDollar: Number(g('ptsPerDollar')), ptsPerDollarRedeem: Number(g('ptsPerDollarRedeem')), pumpCount: Number(g('pumpCount')),
        outdoorPreauthCents: toCents(g('outdoorPreauthCents')), flowMlPerSec: Number(g('flowMlPerSec')), simSpeed: Number(g('simSpeed')) });
      toast('Settings saved');
    } catch (e) { toast(e.message, true); }
  };
}
async function boAudit() {
  const { audit } = await api('GET', '/api/audit');
  $('#boBody').innerHTML = '<div class="card"><h2>Activity</h2>' + tbl(['When', 'Who', 'What', 'Detail'], audit.map((a) => '<tr><td>' + when(a.t) + '</td><td>' + esc(a.who) + '</td><td>' + esc(a.action.replace(/_/g, ' ')) + '</td><td class="small">' + esc(a.detail) + '</td></tr>')) + '</div>';
}

start();
