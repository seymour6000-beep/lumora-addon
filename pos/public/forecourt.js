'use strict';
/* Forecourt simulator: one panel per dispenser. Plays the customer: pay at the pump, lift the nozzle, hang up. */
const { $, $$, esc, money, litres, cpl, api, toast, modal, receiptHTML } = HL;
const fc = { pumps: [], grades: [], settings: {}, brands: [], ui: {} };
const box = $('#fc');

async function start() {
  try {
    const b = await api('GET', '/api/bootstrap');
    Object.assign(fc, { pumps: b.pumps, grades: b.grades, settings: b.settings, brands: b.brands });
  } catch (e) {
    box.innerHTML = '<div class="card">' + (e.status === 401 ? 'Sign in on the <a href="/" style="color:#5eead4">cashier screen</a> first, then reload this page.' : esc(e.message)) + '</div>';
    return;
  }
  const es = new EventSource('/api/live');
  es.addEventListener('pumps', (e) => { fc.pumps = JSON.parse(e.data); render(); $('#live').innerHTML = ''; });
  es.addEventListener('grades', (e) => { fc.grades = JSON.parse(e.data); render(true); });
  es.onerror = () => { $('#live').innerHTML = '<span class="chip bad">Reconnecting…</span>'; };
  render(true);
}
const ui = (n) => (fc.ui[n] = fc.ui[n] || { grade: 'reg', brand: 'Visa', member: '' });

function screen(p) {
  const u = ui(p.n);
  const k = p.status === 'done' ? (p.refundCents ? 'change' : 'owed') : p.status;
  const msg = {
    idle: 'Pay here or pay inside',
    authorized: p.mode === 'outdoor' ? 'Card approved. Lift nozzle.' : p.mode === 'app' ? 'Paid in app. Lift nozzle.' : p.mode === 'prepay' ? 'Prepaid ' + money(p.paidCents) + '. Lift nozzle.' : 'Authorized. Lift nozzle.',
    fuelling: 'Pumping…', owed: 'Please pay inside', change: 'See cashier for your change',
  }[k];
  return '<div class="screen"><div class="msg">' + esc(msg) + '</div><div class="big">' + money(p.cents || 0) + '</div><div class="muted num">' + litres(p.ml) + ' · ' + esc(p.gradeName || (fc.grades.find((g) => g.id === u.grade) || {}).name || '') + '</div></div>';
}
function panel(p) {
  const u = ui(p.n);
  const locked = p.grade && p.status !== 'idle';
  let h = '<div class="disp" data-n="' + p.n + '"><div class="row"><h2 class="grow" style="margin:0">Pump ' + p.n + '</h2>' + (p.mode ? '<span class="chip">' + p.mode + '</span>' : '') + '</div><div class="scr">' + screen(p) + '</div>';
  h += '<div class="grade-pills">' + fc.grades.map((g) => '<button class="grade-pill" data-g="' + g.id + '" style="' + ((locked ? p.grade : u.grade) === g.id ? 'border-color:' + g.color + ';background:#ffffff14' : '') + '"' + (locked && p.grade !== g.id ? ' disabled' : '') + '><span class="dot" style="background:' + esc(g.color) + '"></span>' + esc(g.name) + ' ' + cpl(g.price) + '</button>').join('') + '</div>';
  h += '<div class="acts">' + actions(p) + '</div></div>';
  return h;
}
function actions(p) {
  const u = ui(p.n);
  if (p.status === 'idle') {
    return '<div class="row"><select data-brand style="width:auto">' + fc.brands.map((b) => '<option' + (u.brand === b ? ' selected' : '') + '>' + b + '</option>').join('') + '</select><input data-member placeholder="Points phone (optional)" value="' + esc(u.member) + '" inputmode="tel"></div>'
      + '<div class="row" style="margin-top:8px"><button class="primary grow" data-a="card">Tap card at pump</button><button data-a="app" title="Open the customer app for this pump">Pay in app</button></div>'
      + (p.lastTxId ? '<button class="ghost" data-a="receipt" style="margin-top:6px">Last pump receipt</button>' : '');
  }
  if (p.status === 'authorized') return '<button class="primary big" data-a="lift" style="width:100%">Lift nozzle & start</button>';
  if (p.status === 'fuelling') return '<button class="danger big" data-a="hangup" style="width:100%">Hang up nozzle</button>' + (p.limitCents ? '<div class="muted small" style="margin-top:6px">Stops by itself at ' + money(p.limitCents) + '</div>' : '');
  return '<div class="muted small">Waiting on the cashier.</div>';
}
/* full redraw only when the shape changes; otherwise just refresh screens so inputs keep focus */
let shape = '';
function render(force) {
  const s = fc.pumps.map((p) => p.n + p.status + p.mode + p.grade + (p.lastTxId || '')).join('|') + fc.grades.map((g) => g.price).join();
  if (!force && s === shape) { fc.pumps.forEach((p) => { const el = $('[data-n="' + p.n + '"] .scr'); if (el) el.innerHTML = screen(p); }); return; }
  shape = s;
  box.innerHTML = fc.pumps.map(panel).join('');
  $$('.disp').forEach((d) => {
    const n = Number(d.dataset.n), u = ui(n);
    $$('[data-g]', d).forEach((b) => { b.onclick = () => { u.grade = b.dataset.g; render(true); }; });
    const br = $('[data-brand]', d); if (br) br.onchange = () => { u.brand = br.value; };
    const mb = $('[data-member]', d); if (mb) mb.oninput = () => { u.member = mb.value; };
    $$('[data-a]', d).forEach((b) => { b.onclick = () => act(n, b.dataset.a); });
  });
}
async function act(n, a) {
  const u = ui(n), p = fc.pumps[n - 1];
  try {
    if (a === 'card') { await api('POST', '/api/sim/pumps/' + n + '/card', { brand: u.brand, member: u.member || undefined, grade: undefined }); toast('Card approved · hold ' + money(fc.settings.outdoorPreauthCents)); }
    else if (a === 'app') window.open('/app?pump=' + n, 'hl-app', 'width=440,height=860');
    else if (a === 'lift') await api('POST', '/api/sim/pumps/' + n + '/lift', { grade: p.grade || u.grade });
    else if (a === 'hangup') await api('POST', '/api/sim/pumps/' + n + '/hangup');
    else if (a === 'receipt') {
      const { tx, member } = await api('GET', '/api/tx/' + p.lastTxId);
      modal({ title: 'Pump ' + n + ' receipt', html: receiptHTML(tx, fc.settings, member) });
    }
  } catch (e) { toast(e.message, true); }
}
start();
