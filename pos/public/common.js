'use strict';
/* Harbourline shared helpers: API calls, formatting, dialogs, receipts. */
const HL = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
  const money = (c) => cad.format((c || 0) / 100);
  const litres = (ml) => ((ml || 0) / 1000).toFixed(3) + ' L';
  const cpl = (p) => (p / 10).toFixed(1) + '¢/L';
  const when = (t) => new Date(t).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
  const time = (t) => new Date(t).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  const phone = (p) => (p && p.length === 10 ? '(' + p.slice(0, 3) + ') ' + p.slice(3, 6) + '-' + p.slice(6) : p || '');
  const toCents = (v) => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: body !== undefined || method !== 'GET' ? { 'content-type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : method !== 'GET' ? '{}' : undefined, credentials: 'same-origin' });
    let data = {};
    try { data = await r.json(); } catch (e) { /* empty */ }
    if (!r.ok) { const e = new Error(data.message || ('Error ' + r.status)); e.code = data.error; e.status = r.status; throw e; }
    return data;
  }

  let toastTimer;
  function toast(msg, bad) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 4500 : 2500);
  }

  /* modal({ title, html, wide, actions: [{ label, cls, run(box) -> false keeps it open }], onOpen(box) }) */
  function modal(o) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><h2>' + esc(o.title || '') + '</h2><div class="mb">' + (o.html || '') + '</div><div class="err"></div><div class="actions"></div></div>';
    const box = $('.modal', bg), err = $('.err', bg), acts = $('.actions', bg);
    const close = () => { bg.remove(); document.removeEventListener('keydown', key); if (o.onClose) o.onClose(); };
    box.close = close;
    box.error = (m) => { err.textContent = m || ''; };
    const list = o.actions || [{ label: 'Close' }];
    for (const a of list) {
      const b = document.createElement('button');
      b.textContent = a.label; if (a.cls) b.className = a.cls;
      b.addEventListener('click', async () => {
        if (!a.run) return close();
        b.disabled = true; box.error('');
        try { const keep = await a.run(box); if (keep !== false) close(); }
        catch (e) { box.error(e.message); }
        finally { b.disabled = false; }
      });
      acts.appendChild(b);
    }
    const key = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const p = $$('.actions button.primary', bg)[0]; if (p) { e.preventDefault(); p.click(); } }
    };
    document.addEventListener('keydown', key);
    bg.addEventListener('mousedown', (e) => { if (e.target === bg && !o.sticky) close(); });
    document.body.appendChild(bg);
    if (o.onOpen) o.onOpen(box);
    const f = $('input, select', box); if (f) setTimeout(() => f.focus(), 30);
    return box;
  }
  const confirmBox = (title, html, label = 'OK', cls = 'primary') => new Promise((res) => {
    let yes = false;
    modal({ title, html, onClose: () => res(yes), actions: [{ label: 'Cancel' }, { label, cls, run: () => { yes = true; } }] });
  });

  /* asks for a dollar amount, with quick buttons; resolves cents or null */
  function askMoney(title, { quick = [], note = '', initial = '', min = 1 } = {}) {
    return new Promise((res) => {
      let val = null;
      const html = (note ? '<p class="muted small">' + note + '</p>' : '') + '<input class="amt" inputmode="decimal" placeholder="0.00" value="' + esc(initial) + '" style="font-size:24px;text-align:right">'
        + (quick.length ? '<div class="quick">' + quick.map((q) => '<button data-c="' + q.cents + '">' + esc(q.label || money(q.cents)) + '</button>').join('') + '</div>' : '');
      const box = modal({ title, html, onClose: () => res(val), actions: [{ label: 'Cancel' }, { label: 'OK', cls: 'primary', run: (b) => {
        const c = toCents($('.amt', b).value);
        if (!(c >= min)) throw new Error('Enter an amount');
        val = c;
      } }] });
      $$('.quick button', box).forEach((b) => b.addEventListener('click', () => { val = Number(b.dataset.c); box.close(); }));
    });
  }

  function receiptHTML(tx, s, member) {
    const r = (a, b, cls = '') => '<div class="r ' + cls + '"><span>' + a + '</span><span>' + b + '</span></div>';
    let h = '<div class="receipt"><div class="c b">' + esc(s.storeName) + '</div>' + (s.address ? '<div class="c">' + esc(s.address) + '</div>' : '')
      + '<div class="c">' + when(tx.time) + '</div><div class="c">' + (tx.type === 'refund' ? 'REFUND ' : 'Receipt ') + esc(tx.id)
      + (tx.refundOf ? ' (for ' + esc(tx.refundOf) + ')' : '') + '</div><div class="c">' + (tx.source === 'app' ? 'Paid in app' : tx.source === 'outdoor' ? 'Paid at pump' : 'Cashier: ' + esc(tx.user)) + '</div><hr>';
    for (const l of tx.lines) {
      h += r(esc((l.qty && Math.abs(l.qty) > 1 ? l.qty + ' x ' : '') + (l.label || l.type)) + (l.taxable ? ' H' : ''), money(l.totalCents));
      if (l.type === 'fuel') h += '<div>&nbsp; ' + litres(l.ml) + ' @ ' + cpl(l.price) + '</div>' + (l.discountCents ? r('&nbsp; Fuel saver', '-' + money(l.discountCents)) : '');
      if (l.type === 'prepay' && l.dispensed) h += '<div>&nbsp; Pumped ' + litres(l.dispensed.ml) + ' ' + esc(l.dispensed.gradeName) + ' = ' + money(l.dispensed.cents - (l.dispensed.discountCents || 0)) + '</div>';
      if (l.washCodes) h += l.washCodes.map((c) => '<div class="b">&nbsp; WASH CODE: ' + c + '</div>').join('');
      if (l.card) h += '<div>&nbsp; Card ' + l.card.replace(/(\d{4})(?=\d)/g, '$1 ') + '</div>';
    }
    h += '<hr>' + r('Subtotal', money(tx.subtotalCents));
    if (tx.addedTaxCents) h += r('HST', money(tx.addedTaxCents));
    h += r('TOTAL', money(tx.totalCents), 'b');
    if (tx.includedTaxCents) h += '<div class="small">HST included in fuel: ' + money(tx.includedTaxCents) + '</div>';
    h += '<hr>';
    for (const t of tx.tenders) {
      const name = t.type === 'card' ? t.brand + ' ' + (t.last4 ? '****' + t.last4 : '') + ' ' + (t.method || '') : t.type === 'gift' ? 'Gift card ****' + t.card.slice(-4) : t.type === 'points' ? 'Points (' + Math.abs(t.points) + ')' : 'Cash';
      h += r(esc(name), money(t.cents));
      if (t.auth) h += '<div class="small">&nbsp; Auth ' + t.auth + ' (simulated)</div>';
    }
    if (tx.changeCents) h += r('Change', money(tx.changeCents), 'b');
    if (member || tx.pointsEarned || tx.pointsRedeemed) {
      h += '<hr><div class="c b">Harbour Points</div>';
      if (member) h += r(esc(member.name), '****' + String(member.phone || '').slice(-4));
      if (tx.pointsEarned) h += r('Earned', tx.pointsEarned);
      if (tx.pointsRedeemed) h += r('Redeemed', tx.pointsRedeemed);
      if (member) h += r('Balance', member.points);
    }
    if (tx.approvedBy) h += '<div class="small">Approved by ' + esc(tx.approvedBy) + (tx.reason ? ': ' + esc(tx.reason) : '') + '</div>';
    h += '<hr><div class="c">' + esc(s.footer || '') + '</div><div class="c small">SIMULATION - NOT A REAL RECEIPT</div></div>';
    return h;
  }
  function printReceipt(html) {
    let a = $('#print-area');
    if (!a) { a = document.createElement('div'); a.id = 'print-area'; document.body.appendChild(a); }
    a.innerHTML = html; window.print();
  }

  return { $, $$, esc, money, litres, cpl, when, time, phone, toCents, api, toast, modal, confirmBox, askMoney, receiptHTML, printReceipt };
})();
