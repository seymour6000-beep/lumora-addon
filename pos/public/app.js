'use strict';
/* Harbourline customer app: Harbour Points, pay for fuel from your phone, receipts. */
const { $, $$, esc, money, litres, cpl, when, phone, api, toast, modal, receiptHTML } = HL;
const A = { me: null, tab: 'home', pump: null, grade: 'reg', max: 5000, card: null, poll: null };
const el = $('#phone');
const want = Number(new URLSearchParams(location.search).get('pump')) || null;
if (want) { A.pump = want; A.tab = 'pay'; }

async function refresh() {
  try { A.me = await api('GET', '/api/app/me'); }
  catch (e) { if (e.status === 401) { A.me = null; return signIn(); } throw e; }
  if (!A.card && A.me.wallet.length) A.card = A.me.wallet[0].id;
  if (A.me.active) A.tab = A.tab === 'pay' || A.tab === 'home' ? 'pay' : A.tab;
  render();
}
function schedule() {
  clearTimeout(A.poll);
  if (!A.me) return;
  const fast = A.me && (A.me.active || A.tab === 'pay');
  A.poll = setTimeout(() => refresh().catch(() => {}).finally(schedule), fast ? 900 : 8000);
}

function signIn(mode = 'in') {
  el.innerHTML = '<header><span class="logo"><img src="icon.svg" width="30" height="30" alt=""> Harbourline</span></header><main>'
    + '<div class="card pts"><div class="muted" style="color:#ccfbf1">Harbour Points</div><h2 style="margin-top:6px">Pay at the pump from your phone and earn points on every litre.</h2></div>'
    + '<form class="card" id="f"><h2>' + (mode === 'in' ? 'Sign in' : 'Join Harbour Points') + '</h2>'
    + (mode === 'up' ? '<label>Your name</label><input name="name" autocomplete="given-name">' : '')
    + '<label>Mobile number</label><input name="phone" inputmode="tel" autocomplete="tel" placeholder="(902) 555-0123"><label>4-digit PIN</label><input name="pin" type="password" inputmode="numeric" maxlength="4">'
    + '<div class="err" style="color:#fca5a5;min-height:18px;margin-top:8px;font-size:13px"></div><button class="primary big" style="width:100%">' + (mode === 'in' ? 'Sign in' : 'Join') + '</button>'
    + '<button type="button" class="ghost" id="sw" style="width:100%;margin-top:8px">' + (mode === 'in' ? 'New here? Join Harbour Points' : 'Already a member? Sign in') + '</button>'
    + '<p class="muted small">Already collecting at the counter? Join with the same phone number to keep your points.</p></form></main>';
  $('#sw').onclick = () => signIn(mode === 'in' ? 'up' : 'in');
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('POST', mode === 'in' ? '/api/app/login' : '/api/app/signup', Object.fromEntries(new FormData(e.target))); await refresh(); schedule(); }
    catch (err) { $('.err', e.target).textContent = err.message; }
  };
}

function render() {
  const m = A.me.member;
  el.innerHTML = '<header><span class="logo"><img src="icon.svg" width="28" height="28" alt=""> ' + esc(A.me.storeName) + '</span><button class="ghost small" id="out">Sign out</button></header><main id="m"></main>'
    + '<nav><div>' + [['home', 'Home'], ['pay', 'Pay for fuel'], ['wallet', 'Wallet'], ['history', 'Receipts']].map(([k, l]) => '<button data-t="' + k + '" class="' + (A.tab === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div></nav>';
  $('#out').onclick = async () => { await api('POST', '/api/app/logout'); A.me = null; signIn(); };
  $$('[data-t]').forEach((b) => { b.onclick = () => { A.tab = b.dataset.t; render(); schedule(); }; });
  const main = $('#m');
  if (A.tab === 'home') {
    main.innerHTML = '<div class="card pts"><div style="color:#ccfbf1">Hi ' + esc(m.name) + '</div><div class="v num">' + m.points.toLocaleString() + '</div><div style="color:#ccfbf1">points · worth ' + money(m.pointsValueCents) + '</div>'
      + (m.fuelSaverCpl ? '<div class="chip ok" style="margin-top:8px">Fuel saver: ' + m.fuelSaverCpl + '¢ off every litre</div>' : '') + '</div>'
      + '<div class="card" style="background:#fff;color:#111;text-align:center"><div class="barcode"></div><div class="num" style="margin-top:6px;letter-spacing:1px">' + m.card.replace(/(\d{4})(?=\d)/g, '$1 ') + '</div><div class="small" style="color:#555">Show at the counter, or give your number ' + phone(m.phone) + '</div></div>'
      + '<button class="primary big" id="go">Pay for fuel</button>'
      + '<div class="card"><h3>Fuel prices</h3>' + A.me.grades.map((g) => '<div class="row" style="padding:4px 0"><span class="dot" style="background:' + esc(g.color) + '"></span><span class="grow">' + esc(g.name) + '</span><b class="num">' + cpl(g.price) + '</b></div>').join('') + '</div>'
      + '<div class="card small muted">Earn ' + A.me.earnPerLitre + ' points per litre and ' + A.me.earnPerDollar + ' per $1 in store. Every ' + A.me.redeemEach.toLocaleString() + ' points = $1 off at the counter.</div>';
    $('#go').onclick = () => { A.tab = 'pay'; render(); schedule(); };
  } else if (A.tab === 'pay') payTab(main);
  else if (A.tab === 'wallet') walletTab(main);
  else historyTab(main);
}

function payTab(main) {
  const a = A.me.active;
  if (a) {
    const k = a.status;
    main.innerHTML = '<div class="card" style="text-align:center"><h3>Pump ' + a.n + ' · ' + esc(a.gradeName || 'choose grade at pump') + '</h3>'
      + '<div class="gauge">' + money(a.cents) + '</div><div class="muted num">' + litres(a.ml) + ' · limit ' + money(a.limitCents) + '</div>'
      + '<p>' + (k === 'authorized' ? 'Pump is ready. Lift the nozzle.' : 'Fuelling… it stops by itself at your limit.') + '</p></div>'
      + (k === 'authorized' ? '<div class="pick" id="gp">' + A.me.grades.map((g) => '<button data-g="' + g.id + '" class="' + ((a.grade || A.grade) === g.id ? 'on' : '') + '"' + (a.grade && a.grade !== g.id ? ' disabled' : '') + '>' + esc(g.name) + '</button>').join('') + '</div>'
        + '<button class="primary big" id="lift">Lift nozzle (simulated)</button><button class="danger" id="stop">Cancel</button>'
        : '<button class="danger big" id="stop">Hang up / stop</button>')
      + '<p class="muted small" style="text-align:center">Simulation: these buttons stand in for the real nozzle.</p>';
    $$('[data-g]', main).forEach((b) => { b.onclick = () => { A.grade = b.dataset.g; render(); }; });
    const lift = $('#lift'); if (lift) lift.onclick = () => api('POST', '/api/app/lift', { grade: a.grade || A.grade }).then(refresh).catch((e) => toast(e.message, true));
    $('#stop').onclick = async () => {
      try {
        await api('POST', '/api/app/stop');
        await refresh();
        const last = A.me.history[0];
        if (last && last.source === 'app' && Date.now() - last.time < 15000) showReceipt(last);
      } catch (e) { toast(e.message, true); }
    };
    return;
  }
  const pumps = A.me.pumps;
  const card = A.me.wallet.find((w) => w.id === A.card);
  main.innerHTML = '<div class="card"><h3>1. Your pump</h3><div class="pick">' + pumps.map((p) => '<button data-p="' + p.n + '" class="' + (A.pump === p.n ? 'on' : '') + '"' + (p.free ? '' : ' disabled title="In use"') + '>' + p.n + '</button>').join('') + '</div></div>'
    + '<div class="card"><h3>2. Grade</h3><div class="pick" style="grid-template-columns:1fr 1fr">' + A.me.grades.map((g) => '<button data-g="' + g.id + '" class="' + (A.grade === g.id ? 'on' : '') + '">' + esc(g.name) + '<br><span class="small">' + cpl(g.price) + '</span></button>').join('') + '</div></div>'
    + '<div class="card"><h3>3. Up to</h3><div class="pick">' + [2000, 4000, 6000, 10000].map((c) => '<button data-max="' + c + '" class="' + (A.max === c ? 'on' : '') + '">' + money(c).replace('.00', '') + '</button>').join('') + '</div><p class="muted small">You only pay for what you pump.</p></div>'
    + '<div class="card"><h3>4. Pay with</h3>' + (card ? '<div class="row"><span class="grow">' + esc(card.brand) + ' •••• ' + card.last4 + '</span><button class="ghost" id="chg">Change</button></div>' : '<button id="addc" style="width:100%">Add a card</button>') + '</div>'
    + '<button class="primary big" id="pay"' + (A.pump && card ? '' : ' disabled') + '>Authorize pump ' + (A.pump || '') + '</button>'
    + '<p class="muted small" style="text-align:center">You earn ' + A.me.earnPerLitre + ' points on every litre automatically.</p>';
  $$('[data-p]', main).forEach((b) => { b.onclick = () => { A.pump = Number(b.dataset.p); render(); }; });
  $$('[data-g]', main).forEach((b) => { b.onclick = () => { A.grade = b.dataset.g; render(); }; });
  $$('[data-max]', main).forEach((b) => { b.onclick = () => { A.max = Number(b.dataset.max); render(); }; });
  const chg = $('#chg'); if (chg) chg.onclick = () => { A.tab = 'wallet'; render(); };
  const addc = $('#addc'); if (addc) addc.onclick = () => addCard();
  $('#pay').onclick = async () => {
    try { await api('POST', '/api/app/pay', { pump: A.pump, grade: A.grade, maxCents: A.max, card: A.card }); toast('Pump ' + A.pump + ' is ready'); await refresh(); }
    catch (e) { toast(e.message, true); }
  };
}
function addCard() {
  modal({ title: 'Add a card (simulated)', html: '<p class="muted small">No real card numbers. Pick a brand and the app makes a pretend card.</p><label>Brand</label><select name="b"><option>Visa</option><option>Mastercard</option><option>Amex</option></select>',
    actions: [{ label: 'Cancel' }, { label: 'Add', cls: 'primary', run: async (b) => {
      const { wallet } = await api('POST', '/api/app/wallet', { brand: $('[name=b]', b).value });
      A.me.wallet = wallet; A.card = wallet[wallet.length - 1].id; render();
    } }] });
}
function walletTab(main) {
  main.innerHTML = '<div class="card"><h3>Payment cards</h3>' + (A.me.wallet.length ? A.me.wallet.map((w) => '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><input type="radio" name="w" value="' + w.id + '" style="width:auto"' + (A.card === w.id ? ' checked' : '') + '><span class="grow">' + esc(w.brand) + ' •••• ' + w.last4 + '</span><button class="ghost" data-rm="' + w.id + '">Remove</button></div>').join('') : '<p class="muted">No cards yet.</p>')
    + '<button style="width:100%;margin-top:10px" id="addc">Add a card</button></div><div class="card small muted">Cards here are simulated. Nothing is charged.</div>';
  $$('[name=w]', main).forEach((r) => { r.onchange = () => { A.card = r.value; }; });
  $$('[data-rm]', main).forEach((b) => { b.onclick = async () => { const { wallet } = await api('POST', '/api/app/wallet', { remove: b.dataset.rm }); A.me.wallet = wallet; if (A.card === b.dataset.rm) A.card = wallet[0] ? wallet[0].id : null; render(); }; });
  $('#addc').onclick = addCard;
}
function historyTab(main) {
  const h = A.me.history;
  main.innerHTML = '<div class="card"><h3>Receipts</h3>' + (h.length ? h.map((t, i) => '<div class="row click" data-i="' + i + '" style="padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer"><span class="grow">' + when(t.time) + '<br><span class="small muted">' + ({ app: 'Paid in app', outdoor: 'Paid at pump', counter: 'In store' }[t.source] || '') + (t.pointsEarned ? ' · +' + t.pointsEarned + ' pts' : '') + '</span></span><b class="num">' + money(t.totalCents) + '</b></div>').join('') : '<p class="muted">No visits yet.</p>') + '</div>';
  $$('[data-i]', main).forEach((r) => { r.onclick = () => showReceipt(h[Number(r.dataset.i)]); });
}
function showReceipt(tx) { modal({ title: 'Receipt', html: receiptHTML(tx, { storeName: A.me.storeName, footer: 'Thanks for using Harbourline!' }, A.me.member) }); }

refresh().then(schedule).catch((e) => { el.innerHTML = '<div class="center">' + esc(e.message) + '</div>'; });
