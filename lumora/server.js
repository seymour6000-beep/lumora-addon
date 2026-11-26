'use strict';
/* Lumora server. No dependencies: needs only Node 18.17 or newer.
   - serves the app from ./public
   - accounts with scrypt-hashed passwords and cookie sessions
   - stores the household's settings, rules, scenes and so on on disk
   - controls real lights through Home Assistant (optional) */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const haAdapter = require('./adapters/homeassistant');
const VERSION = require('./package.json').version;

const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || ''));

function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 8080,
    host: env.HOST || '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, 'data')),
    publicDir: path.join(__dirname, 'public'),
    allowSignup: truthy(env.ALLOW_SIGNUP),
    trustProxy: truthy(env.TRUST_PROXY),
    cookieSecure: env.COOKIE_SECURE === undefined || env.COOKIE_SECURE === '' ? 'auto' : truthy(env.COOKIE_SECURE),
    sessionDays: Number(env.SESSION_DAYS) || 30,
    haUrl: env.HA_URL || '',
    haToken: env.HA_TOKEN || '',
    quiet: truthy(env.QUIET),
    adminReset: truthy(env.ADMIN_RESET),
    updateUrl: env.UPDATE_URL || '',
    weatherName: env.WEATHER_NAME || 'Amherst, NS',
    forecastUrl: env.FORECAST_URL || ('https://api.open-meteo.com/v1/forecast?latitude=' + (Number(env.WEATHER_LAT) || 45.8167) + '&longitude=' + (Number(env.WEATHER_LON) || -64.2167)
      + '&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&forecast_days=7&temperature_unit=celsius&timezone=America%2FHalifax'),
    alertsUrl: env.ALERTS_URL || 'https://weather.gc.ca/rss/battleboard/ns14_e.xml',
    schoolUrls: (env.SCHOOL_URLS || 'https://www.ccrce.ca/,https://www.ccrce.ca/school_information/cancellations').split(',').map((x) => x.trim()).filter(Boolean),
    timeZone: env.TZ_NAME || 'America/Halifax',
    weatherUrl: env.WEATHER_URL || ('https://api.open-meteo.com/v1/forecast?latitude=' + (Number(env.WEATHER_LAT) || 45.8167) + '&longitude=' + (Number(env.WEATHER_LON) || -64.2167)
      + '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m&wind_speed_unit=kmh&temperature_unit=celsius&timezone=America%2FHalifax'),
  };
}

/* the keys the app saves on the server (everything else stays in the browser) */
const SYNC_KEYS = new Set([
  'hub-lights', 'hub-rules', 'hub-cams', 'hub-settings', 'hub-scenes', 'hub-removed',
  'hub-apps', 'hub-power',  'hub-activity', 'hub-presence', 'hub-money', 'hub-notify', 'hub-watch', 'hub-others', 'hub-autostat',
]);
const MAX_VALUE = 512 * 1024;
const MAX_BODY = 1024 * 1024;

/* ---------- storage ---------- */
class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(dir, 'backups'), { recursive: true, mode: 0o700 });
    this.dbFile = path.join(dir, 'db.json');
    this.sessFile = path.join(dir, 'sessions.json');
    this.db = this.read(this.dbFile, { version: 1, users: {}, data: {}, rev: 0 });
    this.sessions = this.read(this.sessFile, {});
    this.timers = {};
    this.prune();
    this.backup();
  }
  read(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) {
      if (e.code !== 'ENOENT') {
        try { fs.copyFileSync(file, file + '.corrupt-' + Date.now()); } catch (_) { /* ignore */ }
        console.error('Could not read ' + file + ' (' + e.message + '). A copy was kept next to it. Starting empty.');
      }
      return fallback;
    }
  }
  write(file, obj) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  saveDb() { this.later('db', () => this.write(this.dbFile, this.db)); }
  saveSessions() { this.later('sess', () => this.write(this.sessFile, this.sessions)); }
  later(k, fn) {
    clearTimeout(this.timers[k]);
    this.timers[k] = setTimeout(() => { delete this.timers[k]; try { fn(); } catch (e) { console.error('Save failed:', e.message); } }, 150);
    this.timers[k].unref();
  }
  flush() {
    for (const k of Object.keys(this.timers)) clearTimeout(this.timers[k]);
    this.timers = {};
    this.write(this.dbFile, this.db);
    this.write(this.sessFile, this.sessions);
  }
  prune() {
    const now = Date.now();
    let changed = false;
    for (const k of Object.keys(this.sessions)) if (this.sessions[k].exp < now) { delete this.sessions[k]; changed = true; }
    if (changed) this.saveSessions();
  }
  backup() {
    try {
      if (!fs.existsSync(this.dbFile)) return;
      const day = new Date().toISOString().slice(0, 10);
      const target = path.join(this.dir, 'backups', 'db-' + day + '.json');
      if (!fs.existsSync(target)) fs.copyFileSync(this.dbFile, target);
      const old = fs.readdirSync(path.join(this.dir, 'backups')).filter((f) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      while (old.length > 14) fs.unlinkSync(path.join(this.dir, 'backups', old.shift()));
    } catch (e) { console.error('Backup failed:', e.message); }
  }
}

/* ---------- passwords and tokens ---------- */
const scrypt = (pw, salt) => new Promise((res, rej) =>
  crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
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
/* two-step sign-in (time-based one-time codes, RFC 6238) */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(buf) { let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; }
function b32dec(str) { let bits = ''; for (const c of String(str).replace(/[\s=-]/g, '').toUpperCase()) { const v = B32.indexOf(c); if (v >= 0) bits += v.toString(2).padStart(5, '0'); } const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); }
function hotp(key, counter) { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter)); const h = crypto.createHmac('sha1', key).update(b).digest(); const o = h[19] & 15; const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]; return String(n % 1000000).padStart(6, '0'); }
const timingEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
/* returns the matching 30-second counter, or null; a counter can only be used once (last) */
function totpMatch(secret, code, last) { const key = b32dec(secret), c = Math.floor(Date.now() / 30000); const d6 = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(d6)) return null; for (let d = -1; d <= 1; d++) { const cc = c + d; if (cc <= (last || 0)) continue; if (timingEq(hotp(key, cc), d6)) return cc; } return null; }
const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomCode = (n) => { let o = ''; const r = crypto.randomBytes(n); for (let i = 0; i < n; i++) o += CODE_ALPHA[r[i] % CODE_ALPHA.length]; return o; };
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const cleanName = (s) => String(s || '').replace(/[<>&"']/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
const cleanEmail = (s) => String(s || '').trim().toLowerCase();
const validEmail = (s) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ---------- the app ---------- */
function createApp(userConfig = {}) {
  const cfg = { ...loadConfig({}), ...userConfig };
  const store = new Store(cfg.dataDir);
  const ha = cfg.haUrl && cfg.haToken ? haAdapter.create({ url: cfg.haUrl, token: cfg.haToken, fetchImpl: cfg.fetchImpl, probes: () => { try { const v = JSON.parse(store.db.data['hub-settings'] || '{}').probes; return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } } }) : null;
  const log = (...a) => { if (!cfg.quiet) console.log(new Date().toISOString(), ...a); };

  /* simple rate limiting, kept in memory */
  const fails = new Map();
  const hits = new Map();
  const tidy = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of fails) if (v.until < now && v.last < now - 600000) fails.delete(k);
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    store.prune();
  }, 60000);
  tidy.unref();

  /* optional: look for a newer published version (reads the 'version:' line of a config.yaml or package.json) */
  const vnum = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
  const isNewer = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  let latest = null;
  async function checkUpdate() {
    if (!cfg.updateUrl) return null;
    try {
      const r = await fetch(cfg.updateUrl, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return latest;
      const m = (await r.text()).match(/["']?version["']?\s*[:=]\s*["']?(\d+\.\d+\.\d+)/);
      latest = m && isNewer(m[1], VERSION) ? m[1] : null;
    } catch (e) { /* offline: keep what we knew */ }
    return latest;
  }
  /* weather for the top bar: fetched here (the page may only talk to this server) and kept for 10 minutes */
  let wx = null, wxAt = 0, wxBusy = null;
  function getWeather() {
    if (wx && Date.now() - wxAt < 600000) return Promise.resolve(wx);
    if (wxBusy) return wxBusy;
    wxBusy = (async () => {
      try {
        const r = await fetch(cfg.weatherUrl, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('weather status ' + r.status);
        const c = (await r.json()).current;
        if (!c || typeof c.temperature_2m !== 'number') throw new Error('unexpected weather reply');
        wx = { place: cfg.weatherName, temp: c.temperature_2m, feels: typeof c.apparent_temperature === 'number' ? c.apparent_temperature : c.temperature_2m,
          code: Number(c.weather_code), day: c.is_day !== 0, wind: Number(c.wind_speed_10m) || 0, humidity: Number(c.relative_humidity_2m) || 0, at: Date.now() };
        wxAt = Date.now();
        return wx;
      } catch (e) {
        if (wx && Date.now() - wxAt < 3 * 3600000) return { ...wx, stale: true };
        throw e;
      } finally { wxBusy = null; }
    })();
    return wxBusy;
  }
  /* forecast for the Sky tab: next 24 hours and 7 days, kept for 20 minutes */
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  function parseForecast(j) {
    const h = j && j.hourly, d = j && j.daily;
    if (!h || !d || !Array.isArray(h.time) || !Array.isArray(d.time)) throw new Error('unexpected forecast reply');
    /* times are local to the forecast place (no offset), so they are passed through and the page picks the hours from now on */
    const hours = [];
    for (let i = 0; i < h.time.length && hours.length < 48; i++) {
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(String(h.time[i])) || num(h.temperature_2m[i]) === null) continue;
      hours.push({ t: String(h.time[i]), temp: h.temperature_2m[i], pop: num(h.precipitation_probability && h.precipitation_probability[i]) || 0, code: Number(h.weather_code && h.weather_code[i]) || 0 });
    }
    const days = d.time.slice(0, 7).map((date, i) => ({ date: String(date), code: Number(d.weather_code[i]) || 0, hi: num(d.temperature_2m_max[i]), lo: num(d.temperature_2m_min[i]),
      pop: num(d.precipitation_probability_max && d.precipitation_probability_max[i]) || 0, sunrise: String((d.sunrise || [])[i] || ''), sunset: String((d.sunset || [])[i] || '') })).filter((x) => x.hi !== null && x.lo !== null);
    if (!hours.length || !days.length) throw new Error('empty forecast');
    return { place: cfg.weatherName, hours, days, at: Date.now() };
  }
  let fc = null, fcAt = 0, fcBusy = null;
  function getForecast() {
    if (fc && Date.now() - fcAt < 1200000) return Promise.resolve(fc);
    if (fcBusy) return fcBusy;
    fcBusy = (async () => {
      try {
        const r = await fetch(cfg.forecastUrl, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('forecast status ' + r.status);
        fc = parseForecast(await r.json()); fcAt = Date.now();
        return fc;
      } catch (e) {
        if (fc && Date.now() - fcAt < 6 * 3600000) return { ...fc, stale: true };
        throw e;
      } finally { fcBusy = null; }
    })();
    return fcBusy;
  }
  /* official weather alerts: Environment Canada's Atom feed for Cumberland County North and Cobequid Pass (Amherst) */
  const decode = (t) => String(t).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  const plain = (t) => decode(t).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  function parseAlerts(xml) {
    const out = [];
    for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = m[1];
      const title = plain((e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '');
      if (!title || /^no (alerts|watches or warnings)/i.test(title) || /\bended\b/i.test(title)) continue;
      const t = title.toLowerCase();
      const level = /red warning/.test(t) ? 'red' : /orange warning/.test(t) ? 'orange' : /yellow warning/.test(t) ? 'yellow' : /warning/.test(t) ? 'orange' : /watch/.test(t) ? 'watch' : 'info';
      const link = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
      out.push({ title: title.replace(/,\s*Cumberland County.*$/i, '').slice(0, 120), level, url: /^https:\/\/(www\.)?weather\.gc\.ca\//.test(link) ? link : 'https://weather.gc.ca/warnings/index_e.html?prov=ns',
        updated: (e.match(/<updated>([^<]+)<\/updated>/) || [])[1] || '' });
    }
    return out;
  }
  let al = null, alAt = 0, alBusy = null;
  function getAlerts() {
    if (al && Date.now() - alAt < 300000) return Promise.resolve(al);
    if (alBusy) return alBusy;
    alBusy = (async () => {
      try {
        const r = await fetch(cfg.alertsUrl, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('alerts status ' + r.status);
        al = { region: 'Cumberland County North and Cobequid Pass', alerts: parseAlerts(await r.text()), at: Date.now() };
        alAt = Date.now();
        return al;
      } catch (e) {
        if (al && Date.now() - alAt < 30 * 60000) return { ...al, stale: true };
        throw e;
      } finally { alBusy = null; }
    })();
    return alBusy;
  }

  /* school notices: the board (CCRCE) publishes closures as plain notices, with no feed, so this only looks for a notice dated today.
     "none" means no notice was found, which is not proof that schools are open. */
  function localParts(d = new Date()) {
    const f = (o) => new Intl.DateTimeFormat('en-US', { timeZone: cfg.timeZone, ...o }).format(d);
    return { weekday: f({ weekday: 'long' }), month: f({ month: 'long' }), mon: f({ month: 'short' }), day: f({ day: 'numeric' }), year: f({ year: 'numeric' }) };
  }
  function scanSchool(text, lp) {
    const dates = [`${lp.weekday}, ${lp.month} ${lp.day}, ${lp.year}`, `${lp.month} ${lp.day}, ${lp.year}`, `${lp.mon}. ${lp.day}, ${lp.year}`, `${lp.mon} ${lp.day}, ${lp.year}`];
    let best = null; const rank = { closed: 3, buses: 2, delayed: 1 };
    for (const d of dates) {
      let i = -1;
      while ((i = text.indexOf(d, i + 1)) !== -1) {
        const w = text.slice(Math.max(0, i - 260), i + d.length + 260);
        if (!/(Cumberland|all CCRCE|all schools|Amherst|Chignecto)/i.test(w)) continue;
        let kind = null;
        if (/clos(ed|ure)/i.test(w)) kind = 'closed'; else if (/bus(es)?[^.]{0,40}cancel|cancel[^.]{0,40}bus/i.test(w)) kind = 'buses'; else if (/delay/i.test(w)) kind = 'delayed'; else if (/cancel/i.test(w)) kind = 'closed';
        if (kind && (!best || rank[kind] > rank[best.kind])) best = { kind, detail: w.replace(/\s+/g, ' ').trim().slice(0, 200) };
      }
    }
    return best;
  }
  let sc = null, scAt = 0, scBusy = null;
  function getSchool() {
    if (sc && Date.now() - scAt < 300000) return Promise.resolve(sc);
    if (scBusy) return scBusy;
    scBusy = (async () => {
      const lp = localParts();
      let res;
      if (lp.weekday === 'Saturday' || lp.weekday === 'Sunday') res = { status: 'weekend' };
      else {
        let loaded = 0, best = null;
        for (const u of cfg.schoolUrls) {
          try {
            const r = await fetch(u, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Lumora/' + VERSION } });
            if (!r.ok) continue;
            const html = (await r.text()).slice(0, 1500000);
            loaded++;
            const text = plain(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' '));
            const f = scanSchool(text, lp);
            if (f && (!best || { closed: 3, buses: 2, delayed: 1 }[f.kind] > { closed: 3, buses: 2, delayed: 1 }[best.kind])) best = f;
          } catch (e) { /* try the next page */ }
        }
        res = best ? { status: best.kind, detail: best.detail } : { status: loaded ? 'none' : 'unknown' };
      }
      res.at = Date.now(); res.url = cfg.schoolUrls[cfg.schoolUrls.length - 1] || '';
      sc = res; scAt = Date.now();
      return res;
    })().finally(() => { scBusy = null; });
    return scBusy;
  }
  const updTimer = cfg.updateUrl ? setInterval(checkUpdate, 6 * 3600 * 1000) : null;
  if (updTimer) updTimer.unref();
  const updFirst = cfg.updateUrl ? setTimeout(checkUpdate, 5000) : null;
  if (updFirst) updFirst.unref();


  /* ---- phone alerts: Lumora asks Home Assistant to send them through its mobile app (or any notify service) ---- */
  const nState = { leftOnSince: 0, leftOnSent: false, offlineSeen: new Map(), offlineSent: new Set(), lastRemind: new Map(), flapSent: new Map(), groupSent: false, busy: false };
  const hhmmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
  const inQuiet = (w, now) => { const q = w && w.quiet; if (!q || !q.on || !/^\d\d:\d\d$/.test(q.from || '') || !/^\d\d:\d\d$/.test(q.to || '')) return false; const cur = hhmmFmt.format(now); return q.from <= q.to ? (cur >= q.from && cur < q.to) : (cur >= q.from || cur < q.to); };
  const niceDur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? m + ' min' : (Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '')); };
  const readJson2 = (k, d) => { try { const v = JSON.parse(store.db.data[k]); return v == null ? d : v; } catch (e) { return d; } };
  async function notifyTick() {
    if (!ha) return;
    const n = readJson2('hub-notify', {});
    const phoneOk = n && ha.isNotifyId(n.smsService) && /^\+[1-9][0-9]{7,14}$/.test(String(n.phone || ''));
    if (!n || (!ha.isNotifyId(n.service) && !phoneOk)) return;
    const send = async (title, msg) => {
      if (ha.isNotifyId(n.service)) { try { await ha.notify(n.service, title, msg); } catch (e) { log('notify failed', e.message); } }
      if (phoneOk) { try { await ha.notify(n.smsService, title, msg, n.phone); } catch (e) { log('text failed', e.message); } }
    };
    const now = Date.now();
    const watch = readJson2('hub-watch', {}) || {};
    const quiet = inQuiet(watch, now);
    const sendQ = async (title, msg) => { if (quiet) return false; await send(title, msg); return true; };
    if (n.warnings !== false) {
      try {
        const sent = (store.db.notified = store.db.notified || {});
        const a = await getAlerts();
        for (const al of a.alerts || []) {
          const id = (al.title + '|' + al.updated).slice(0, 200);
          if (!sent[id]) { sent[id] = now; await send('Weather warning', al.title); store.saveDb(); }
        }
        for (const k of Object.keys(sent)) if (now - sent[k] > 3 * 86400000) delete sent[k];
      } catch (e) { /* feed unavailable: try again next time */ }
    }
    let lights = null;
    if (n.leftOn !== false || n.offline !== false) {
      try { lights = await ha.allLights(); } catch (e) { return; }
      const mine = new Set(readJson2('hub-lights', []).map((d) => d && d.id)); const gone = new Set(readJson2('hub-removed', []));
      lights = lights.filter((l) => !gone.has(l.id) && (mine.size === 0 || mine.has(l.id)));
    }
    if (n.offline !== false && lights) {
      const muted = new Set(Array.isArray(watch.muted) ? watch.muted : []);
      const waitMs = watch.delay != null ? Math.max(0, Math.min(3600, Number(watch.delay) || 0)) * 1000 : (cfg.offlineWaitMs != null ? cfg.offlineWaitMs : 60000);
      const remindMs = Math.max(0, Math.min(168, Number(watch.reminderH) || 0)) * 3600000;
      const watched = lights.filter((l) => !muted.has(l.id));
      for (const l of watched) {
        if (l.online) {
          if (nState.offlineSent.has(l.id) && watch.backOnline !== false) {
            const was = nState.offlineSeen.get(l.id);
            if (await sendQ('Light back online', l.name + ' is responding again' + (was ? ' after ' + niceDur(now - was) : '') + '.')) { nState.offlineSeen.delete(l.id); nState.offlineSent.delete(l.id); nState.lastRemind.delete(l.id); }
          } else { nState.offlineSeen.delete(l.id); nState.offlineSent.delete(l.id); nState.lastRemind.delete(l.id); }
          continue;
        }
        const first = nState.offlineSeen.get(l.id) || now; nState.offlineSeen.set(l.id, first);
        if (now - first >= waitMs && !nState.offlineSent.has(l.id)) {
          if (await sendQ('Light offline', l.name + ' isn’t responding. Check that it has power and Wi-Fi.')) { nState.offlineSent.add(l.id); nState.lastRemind.set(l.id, now); }
        } else if (nState.offlineSent.has(l.id) && remindMs && now - (nState.lastRemind.get(l.id) || first) >= remindMs) {
          if (await sendQ('Still offline', l.name + ' has been offline for ' + niceDur(now - first) + '.')) nState.lastRemind.set(l.id, now);
        }
      }
      /* a light that keeps dropping out: several offline events within the last hour, even if each one was too short to alert on */
      if (watch.flap !== false) {
        const limit = Math.max(2, Math.min(10, Number(watch.flapN) || 3));
        for (const l of watched) {
          const recent = hist.events.filter((e) => e.id === l.id && e.type === 'offline' && now - e.t <= 3600000).length;
          const sentAt = nState.flapSent.get(l.id) || 0;
          if (recent >= limit && now - sentAt > 6 * 3600000) { if (await sendQ('Light keeps dropping out', l.name + ' went offline ' + recent + ' times in the last hour. That usually means weak Wi-Fi, a loose bulb, or a switch that cuts its power.')) nState.flapSent.set(l.id, now); }
        }
      }
      /* several lights down together but not all of them: points at the router or Wi-Fi, not the bulbs (all of them means a power cut, which has its own alert) */
      if (watch.group !== false && watched.length >= 3) {
        const down = watched.filter((l) => !l.online);
        const together = down.length >= Math.max(2, Number(watch.groupMin) || 2) && down.length < watched.length && down.length * 2 >= watched.length;
        if (!together) nState.groupSent = false;
        else if (!nState.groupSent && down.every((l) => now - (nState.offlineSeen.get(l.id) || now) >= waitMs)) {
          if (await sendQ('Several lights are offline', down.length + ' of ' + watched.length + ' lights dropped at once (' + down.slice(0, 4).map((l) => l.name).join(', ') + '). Check your router or Wi-Fi extender first.')) nState.groupSent = true;
        }
      }
    }
    if (n.leftOn !== false && lights) {
      let away;
      try { const ps = await ha.persons(); away = ps.length ? ps.every((x) => !x.home) : readJson2('hub-presence', 'home') === 'away'; } catch (e) { away = readJson2('hub-presence', 'home') === 'away'; }
      const on = lights.filter((l) => l.online && l.on);
      if (!away || !on.length) { nState.leftOnSince = 0; nState.leftOnSent = false; }
      else {
        nState.leftOnSince = nState.leftOnSince || now;
        const wait = Math.max(1, Math.min(120, Number(n.leftOnMins) || 10)) * 60000;
        if (!nState.leftOnSent && now - nState.leftOnSince >= wait) { nState.leftOnSent = true; await send('Lights left on', 'Nobody is home and ' + on.length + (on.length === 1 ? ' light is' : ' lights are') + ' still on: ' + on.slice(0, 4).map((l) => l.name).join(', ') + (on.length > 4 ? '…' : '') + '.'); }
      }
    }
  }
  const notifyTimer = ha ? setInterval(() => { if (nState.busy) return; nState.busy = true; notifyTick().catch(() => {}).finally(() => { nState.busy = false; }); }, cfg.notifyEveryMs || 30000) : null;
  if (notifyTimer) notifyTimer.unref();

  /* ---- a light that comes back online stays off (bulbs usually power up ON after a drop-out) ---- */
  /* usage history: how long each light was on each day, and when lights dropped off or came back (kept on disk, so it keeps recording with no browser open) */
  const histFile = path.join(cfg.dataDir, 'history.json');
  const hist = store.read(histFile, { days: {}, names: {}, events: [], last: {} });
  hist.days = hist.days || {}; hist.names = hist.names || {}; hist.events = Array.isArray(hist.events) ? hist.events : []; hist.last = hist.last || {};
  let histDirty = false, histT = 0;
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayKey = (t) => dayFmt.format(t);
  function recordHistory(lights, now = Date.now()) {
    const dt = histT ? Math.min(15000, Math.max(0, now - histT)) / 1000 : 0; histT = now;
    const dk = dayKey(now), day = hist.days[dk] || (hist.days[dk] = {});
    const gone = new Set(readJson2('hub-removed', []));
    for (const l of lights) {
      if (gone.has(l.id)) continue;
      hist.names[l.id] = l.name;
      const st = !l.online ? 'offline' : l.on ? 'on' : 'off', prev = hist.last[l.id];
      if (l.online && l.on && dt) day[l.id] = Math.round(((day[l.id] || 0) + dt) * 10) / 10;
      if (prev !== st) {
        if (prev !== undefined || st === 'offline') hist.events.push({ t: now, id: l.id, name: l.name, type: st === 'offline' ? 'offline' : prev === 'offline' ? 'online' : st });
        hist.last[l.id] = st;
      }
    }
    if (hist.events.length > 1500) hist.events.splice(0, hist.events.length - 1500);
    const keep = Object.keys(hist.days).sort().slice(-120); for (const k of Object.keys(hist.days)) if (!keep.includes(k)) delete hist.days[k];
    histDirty = true;
  }
  function saveHistory() { if (!histDirty) return; histDirty = false; try { store.write(histFile, hist); } catch (e) { console.error('History save failed:', e.message); } }
  const histTimer = setInterval(saveHistory, 60000); histTimer.unref();
  function historyView(n) {
    const out = [], now = Date.now();
    for (let i = n - 1; i >= 0; i--) { const dk = dayKey(now - i * 86400000), by = hist.days[dk] || {}; out.push({ date: dk, sec: Math.round(Object.values(by).reduce((a, b) => a + b, 0)), by }); }
    const cutoff = now - n * 86400000;
    return { days: out, names: hist.names, events: hist.events.filter((e) => e.t >= cutoff).slice(-400), now, tz: cfg.timeZone };
  }
  /* ---- automations that run on the server ---- */
  let autoLog = store.read(path.join(cfg.dataDir, 'autolog.json'), []); if (!Array.isArray(autoLog)) autoLog = [];
  let autoLogDirty = false;
  const pushMsg = async (title, msg) => {
    if (!ha) return; const n = readJson2('hub-notify', {}) || {};
    if (ha.isNotifyId(n.service)) { try { await ha.notify(n.service, title, msg); } catch (e) { log('notify failed', e.message); } }
    if (ha.isNotifyId(n.smsService) && /^\+[1-9][0-9]{7,14}$/.test(String(n.phone || ''))) { try { await ha.notify(n.smsService, title, msg, n.phone); } catch (e) { log('text failed', e.message); } }
  };
  const auto = ha ? require('./automations').create({
    ha, readJson: readJson2, tz: cfg.timeZone, notify: pushMsg,
    activity: (m) => { autoLog.unshift({ t: Date.now(), m: String(m).slice(0, 200) }); autoLog.length = Math.min(autoLog.length, 100); autoLogDirty = true; broadcast('auto', { t: Date.now() }); },
    onStat: (st) => { store.db.data['hub-autostat'] = JSON.stringify(st); store.saveDb(); },
  }) : null;
  if (auto) auto.setStats(readJson2('hub-autostat', {}));
  const autoFlush = setInterval(() => { if (!autoLogDirty) return; autoLogDirty = false; try { store.write(path.join(cfg.dataDir, 'autolog.json'), autoLog); } catch (e) { /* ignore */ } }, 30000); autoFlush.unref();
  const rec = { prev: new Map(), recent: new Map(), busy: false };
  function wantKeepOff(id, outage) {
    const st = readJson2('hub-settings', {});
    if (st.keepOffReturn === false) return false;
    if (Array.isArray(st.powerOn) && st.powerOn.includes(id)) return false;
    if (outage && st.afterPower && st.afterPower !== 'keepOff') return false;   /* the outage settings decide after a whole-house power cut */
    return true;
  }
  async function keepOff(id, outage) {
    if (!ha || !wantKeepOff(id, outage)) return;
    const t = rec.recent.get(id); if (t && Date.now() - t < 5000) return;
    rec.recent.set(id, Date.now());
    try { await ha.setLight(id, { on: false }); log('kept off after returning online:', id); } catch (e) { log('keep-off failed', e.message); }
  }
  async function recoverTick() {
    if (!ha || rec.busy) return; rec.busy = true;
    try {
      const lights = await ha.allLights();
      try { recordHistory(lights); } catch (e) { /* never block the checks */ }
      try { if (auto) auto.onLights(lights); } catch (e) { /* never block the checks */ }
      const gone = new Set(readJson2('hub-removed', []));
      const offBefore = [...rec.prev.values()].filter((v) => v === false).length;
      const outage = lights.length > 1 && offBefore >= lights.length;
      for (const l of lights) {
        const was = rec.prev.get(l.id);
        if (was === false && l.online && l.on && !gone.has(l.id)) await keepOff(l.id, outage);
        rec.prev.set(l.id, l.online);
      }
    } catch (e) { /* next time */ } finally { rec.busy = false; }
  }
  const recTimer = ha ? setInterval(recoverTick, cfg.recoverEveryMs || 5000) : null;
  if (recTimer) recTimer.unref();

  /* ---- live link to Home Assistant: it tells us the moment a light changes or drops off, instead of waiting for the next check ---- */
  const sse = new Set();
  const live = { ok: false, ws: null, timer: null, retry: 1000, closed: false, lastEvent: 0, probeTimer: null };
  let nudgeT = null;
  function broadcast(ev, data) {
    const msg = 'event: ' + ev + '\ndata: ' + JSON.stringify(data) + '\n\n';
    for (const r of sse) { try { r.write(msg); } catch (e) { sse.delete(r); } }
  }
  function onLiveEvent(evt) {
    const d = evt && evt.data; if (!d || !ha) return;
    if (ha.isOtherId(d.entity_id)) {
      if (d.new_state && readJson2('hub-others', []).some((x) => x && x.id === d.entity_id)) { live.lastEvent = Date.now(); try { const o = ha.mapOther(d.new_state, null); broadcast('other', o); if (auto) auto.onOther(o); } catch (e) { /* ignore */ } }
      return;
    }
    if (!ha.isLightId(d.entity_id)) return;
    live.lastEvent = Date.now();
    const st = d.new_state && d.new_state.state;
    const was = d.old_state && d.old_state.state;
    if ((was === 'unavailable' || was === 'unknown') && st === 'on') { const all = [...rec.prev.values()]; keepOff(d.entity_id, all.length > 1 && all.every((v) => v === false)); }
    if (st) rec.prev.set(d.entity_id, st !== 'unavailable' && st !== 'unknown');
    broadcast('light', { id: d.entity_id, online: st !== 'unavailable' && st !== 'unknown', on: st === 'on' });
    /* check phone alerts soon, and again once a light has been gone long enough to count */
    clearTimeout(nudgeT);
    nudgeT = setTimeout(() => { if (!nState.busy) { nState.busy = true; notifyTick().catch(() => {}).finally(() => { nState.busy = false; }); } }, cfg.nudgeMs != null ? cfg.nudgeMs : 2000);
    if (nudgeT.unref) nudgeT.unref();
    if (st === 'unavailable') { const t2 = setTimeout(() => { if (!nState.busy) { nState.busy = true; notifyTick().catch(() => {}).finally(() => { nState.busy = false; }); } }, cfg.offlineWaitMs != null ? cfg.offlineWaitMs + 1000 : 61000); if (t2.unref) t2.unref(); }
  }
  function connectLive() {
    const WS = cfg.WebSocketImpl || globalThis.WebSocket;
    if (!ha || !WS || live.closed) return;
    let ws;
    try { const base = String(cfg.haUrl).replace(/\/+$/, '').replace(/^http/, 'ws'); ws = new WS(base + (/\/core$/.test(base) ? '/websocket' : '/api/websocket')); } catch (e) { return scheduleLive(); }
    live.ws = ws;
    ws.onmessage = (m) => {
      let j; try { j = JSON.parse(typeof m.data === 'string' ? m.data : String(m.data)); } catch (e) { return; }
      if (j.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: cfg.haToken }));
      else if (j.type === 'auth_ok') { live.ok = true; live.retry = 1000; ws.send(JSON.stringify({ id: 1, type: 'subscribe_events', event_type: 'state_changed' })); broadcast('live', { ok: true }); }
      else if (j.type === 'auth_invalid') { live.ok = false; live.closed = true; log('live link: Home Assistant rejected the token'); try { ws.close(); } catch (e) { /* ignore */ } }
      else if (j.type === 'event') onLiveEvent(j.event);
    };
    const lost = () => { if (live.ws !== ws) return; live.ws = null; if (live.ok) broadcast('live', { ok: false }); live.ok = false; scheduleLive(); };
    ws.onclose = lost; ws.onerror = lost;
  }
  function scheduleLive() {
    if (live.closed || live.timer) return;
    live.timer = setTimeout(() => { live.timer = null; connectLive(); }, live.retry);
    if (live.timer.unref) live.timer.unref();
    live.retry = Math.min(60000, live.retry * 2);
  }
  /* some integrations only learn a bulb is gone when asked: ask them to refresh, once a minute */
  async function probeLights() {
    if (!ha || cfg.probe === false) return;
    try { const ids = (await ha.allLights()).map((l) => l.id).slice(0, 60); if (ids.length) await ha.refresh(ids); } catch (e) { /* next time */ }
  }
  if (ha) {
    connectLive();
    live.probeTimer = cfg.probe === false ? null : setInterval(probeLights, cfg.probeEveryMs || 60000);
    if (live.probeTimer) live.probeTimer.unref();
  }
  const sseKeep = setInterval(() => { for (const r of sse) { try { r.write(': keep\n\n'); } catch (e) { sse.delete(r); } } }, 20000);
  sseKeep.unref();

  function clientIp(req) {
    if (cfg.trustProxy) {
      const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (xf) return xf;
    }
    return req.socket.remoteAddress || 'unknown';
  }
  function isHttps(req) {
    if (cfg.cookieSecure === true) return true;
    if (cfg.cookieSecure === false) return false;
    return cfg.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  }
  function bump(map, key, limit, windowMs) {
    const now = Date.now();
    let e = map.get(key);
    if (!e || e.reset < now) { e = { n: 0, reset: now + windowMs }; map.set(key, e); }
    e.n++;
    return e.n > limit ? Math.ceil((e.reset - now) / 1000) : 0;
  }

  /* static files, read once and compressed */
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
  const statics = new Map();
  function loadStatics() {
    statics.clear();
    (function walk(dir, rel) {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (f.name.startsWith('.')) continue;
        const full = path.join(dir, f.name), r = rel + '/' + f.name;
        if (f.isDirectory()) walk(full, r);
        else {
          const buf = fs.readFileSync(full), ext = path.extname(f.name).toLowerCase();
          const text = ['.html', '.js', '.json', '.webmanifest', '.svg', '.txt'].includes(ext);
          statics.set(r, { buf, gz: text ? zlib.gzipSync(buf) : null, type: mime[ext] || 'application/octet-stream', ext, name: f.name });
        }
      }
    })(cfg.publicDir, '');
  }
  loadStatics();

  function secHeaders(req, h = {}) {
    const out = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      ...h,
    };
    if (isHttps(req)) out['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    return out;
  }

  function send(req, res, code, body, headers = {}) {
    res.writeHead(code, secHeaders(req, headers));
    res.end(body);
  }
  function json(req, res, code, obj, headers = {}) {
    send(req, res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Lumora': '1', ...headers });
  }
  const fail = (req, res, code, error, message, extra = {}) => json(req, res, code, { error, message, ...extra });

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }
  async function readJson(req) {
    const t = await readBody(req);
    if (!t) return {};
    try {
      const v = JSON.parse(t);
      if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('shape');
      return v;
    } catch (e) { throw Object.assign(new Error('bad json'), { status: 400 }); }
  }

  /* sessions */
  function parseCookies(req) {
    const out = {};
    String(req.headers.cookie || '').split(';').forEach((p) => {
      const i = p.indexOf('=');
      if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
    return out;
  }
  function currentSession(req) {
    const tok = parseCookies(req).lumora_sid;
    if (!tok || tok.length < 20) return null;
    const s = store.sessions[sha(tok)];
    if (!s || s.exp < Date.now()) return null;
    const user = store.db.users[s.uid];
    if (!user) return null;
    return { key: sha(tok), s, user };
  }
  /* TV pairing: a TV shows a short code, a signed-in phone approves it, then only that TV (which holds a secret) gets a session */
  const tickets = new Map(); // two-step sign-in tickets: sha(ticket) -> { uid, exp, tries, keep }
  const sweepT = setInterval(() => { const n = Date.now(); for (const [k, v] of tickets) if (v.exp < n) tickets.delete(k); }, 60000); sweepT.unref();
  function check2fa(u, raw) {
    if (!u.totp || !u.totp.on) return false;
    const code = String(raw || '').trim();
    if (/^\d{3}\s?\d{3}$/.test(code)) { const c = totpMatch(u.totp.secret, code, u.totp.last); if (c === null) return false; u.totp.last = c; store.flush(); return true; }
    const h = sha(normCode(code)), i = (u.totp.rec || []).indexOf(h);
    if (i >= 0) { u.totp.rec.splice(i, 1); store.flush(); return true; }
    return false;
  }
  if (cfg.adminReset) {
    const admin = Object.values(store.db.users).filter((u) => u.role === 'admin').sort((a, b) => a.created - b.created)[0];
    if (admin) { const code = randomCode(8); store.db.resets = store.db.resets || {}; store.db.resets[admin.id] = { h: sha(code), exp: Date.now() + 900000, clear2fa: true }; store.flush(); console.log('Lumora: password reset code for ' + admin.email + ' is ' + code.slice(0, 4) + '-' + code.slice(4) + ' (valid 15 minutes). On the sign-in page choose “Forgot password”. Turn the “admin_reset” option off again afterwards.'); }
    else console.log('Lumora: admin_reset is on, but there is no account yet.');
  }
  const tvPending = new Map(); // sha(secret) -> { code, exp, uid, ip }
  const tvSweep = () => { const n = Date.now(); for (const [k, v] of tvPending) if (v.exp < n) tvPending.delete(k); };
  const tvFind = (code) => { tvSweep(); for (const v of tvPending.values()) if (v.code === code) return v; return null; };
  const isLanIp = (ip) => /^(::1$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fe80:|f[cd][0-9a-f]{2}:|::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/i.test(String(ip));
  function startSession(req, res, user, keep) {
    const tok = crypto.randomBytes(32).toString('base64url');
    const maxAge = keep ? cfg.sessionDays * 86400 : 12 * 3600;
    store.sessions[sha(tok)] = { uid: user.id, exp: Date.now() + maxAge * 1000, created: Date.now() };
    store.saveSessions();
    return cookie(req, tok, keep ? maxAge : null);
  }
  function cookie(req, value, maxAge) {
    return 'lumora_sid=' + value + '; Path=/; HttpOnly; SameSite=Lax' + (maxAge ? '; Max-Age=' + maxAge : '') + (isHttps(req) ? '; Secure' : '');
  }
  const clearCookie = (req) => 'lumora_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + (isHttps(req) ? '; Secure' : '');
  /* roles: admin (everything), family (everything except Money and phone numbers, unless the admin allows Money), guest (lights and devices only) */
  const roleOf = (u) => (u.role === 'admin' ? 'admin' : u.role === 'guest' ? 'guest' : 'family');
  const canMoney = (u) => roleOf(u) === 'admin' || (roleOf(u) === 'family' && u.money === true);
  const keyRead = (u, k) => { const r = roleOf(u); if (k === 'hub-notify') return r === 'admin'; if (k === 'hub-money') return canMoney(u); if (r === 'guest' && k === 'hub-rules') return false; return true; };
  const keyWrite = (u, k) => { const r = roleOf(u); if (k === 'hub-autostat') return false; if (r === 'admin') return true; if (k === 'hub-notify') return false; if (k === 'hub-money') return canMoney(u); if (r === 'guest') return k === 'hub-lights' || k === 'hub-activity'; return true; };
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: roleOf(u), money: canMoney(u), twofa: !!(u.totp && u.totp.on) });
  const userCount = () => Object.keys(store.db.users).length;
  const bootData = (u) => { const d = {}; for (const k of SYNC_KEYS) if (typeof store.db.data[k] === 'string' && (!u || keyRead(u, k))) d[k] = store.db.data[k]; return d; };

  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      const host = (cfg.trustProxy && req.headers['x-forwarded-host']) || req.headers.host;
      return new URL(origin).host === String(host).split(',')[0].trim();
    } catch (e) { return false; }
  }

  /* ---------- API ---------- */
  async function api(req, res, url) {
    const method = req.method, p = url.pathname;
    const ip = clientIp(req);

    if (p === '/api/health' && method === 'GET') return json(req, res, 200, { ok: true, version: VERSION, latest, uptime: Math.round(process.uptime()), ha: ha ? { live: live.ok } : null });

    if (method !== 'GET' && method !== 'HEAD') {
      if (String(req.headers['x-requested-with'] || '').toLowerCase() !== 'lumora' || !sameOrigin(req)) return fail(req, res, 403, 'forbidden', 'Request blocked.');
    }

    if (p === '/api/boot' && method === 'GET') {
      const sess = currentSession(req);
      return json(req, res, 200, {
        server: true,
        version: VERSION,
        latest,
        config: { allowSignup: cfg.allowSignup, firstRun: userCount() === 0, adapter: ha ? 'homeassistant' : 'demo', automations: !!ha, serverTypes: ['time', 'sun', 'lefton', 'lightoff', 'sensor', 'lockev', 'temp', 'home', 'away', 'manual'] },
        user: sess ? publicUser(sess.user) : null,
        data: sess ? bootData(sess.user) : null,
        rev: store.db.rev,
      });
    }

    if (p === '/api/weather' && method === 'GET') {
      if (!currentSession(req)) return fail(req, res, 401, 'signed_out', 'Please sign in.');
      const wait = bump(hits, 'wx|' + ip, 30, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Too many requests. Try again in ' + wait + ' seconds.', { retryAfter: wait });
      try { return json(req, res, 200, await getWeather()); }
      catch (e) { return fail(req, res, 502, 'weather_unavailable', 'Weather isn’t available right now.'); }
    }

    if ((p === '/api/alerts' || p === '/api/school') && method === 'GET') {
      if (!currentSession(req)) return fail(req, res, 401, 'signed_out', 'Please sign in.');
      const wait = bump(hits, 'info|' + ip, 40, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Too many requests. Try again in ' + wait + ' seconds.', { retryAfter: wait });
      try { return json(req, res, 200, p === '/api/alerts' ? await getAlerts() : await getSchool()); }
      catch (e) { return fail(req, res, 502, 'unavailable', 'That information isn’t available right now.'); }
    }

    if ((p === '/api/tv/check' || p === '/api/tv/approve') && method === 'POST') {
      const cs = currentSession(req);
      if (!cs) return fail(req, res, 401, 'signed_out', 'Please sign in.');
      const wait = bump(hits, 'tva|' + cs.user.id, 10, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Too many attempts. Try again in ' + wait + ' seconds.', { retryAfter: wait });
      const b = await readJson(req);
      const e = tvFind(String(b.code || '').replace(/\D/g, '').slice(0, 6));
      if (!e || e.uid) return fail(req, res, 404, 'bad_code', 'That code isn’t valid or has expired. Check the number on the TV.');
      if (p === '/api/tv/check') return json(req, res, 200, { ok: true, home: isLanIp(e.ip), seconds: Math.round((Date.now() - e.at) / 1000) });
      e.uid = cs.user.id; log('TV approved');
      return json(req, res, 200, { ok: true });
    }

    if (p === '/api/forecast' && method === 'GET') {
      if (!currentSession(req)) return fail(req, res, 401, 'signed_out', 'Please sign in.');
      const wait = bump(hits, 'fc|' + ip, 20, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Too many requests. Try again in ' + wait + ' seconds.', { retryAfter: wait });
      try { return json(req, res, 200, await getForecast()); } catch (e) { return fail(req, res, 502, 'unavailable', 'The forecast isn’t available right now.'); }
    }

    if (p === '/api/check-update' && method === 'POST') {
      if (!currentSession(req)) return fail(req, res, 401, 'signed_out', 'Please sign in.');
      const wait = bump(hits, 'upd|' + ip, 6, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Checked a moment ago. Try again in ' + wait + ' seconds.', { retryAfter: wait });
      await checkUpdate();
      return json(req, res, 200, { version: VERSION, latest, checked: !!cfg.updateUrl });
    }

    if (p === '/api/signup' && method === 'POST') {
      const wait = bump(hits, 'auth|' + ip, 30, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Too many attempts. Try again in ' + wait + ' seconds.', { retryAfter: wait });
      const first = userCount() === 0;
      if (!first && !cfg.allowSignup) return fail(req, res, 403, 'signup_disabled', 'New sign-ups are turned off on this server. Ask the household admin to add you.');
      const b = await readJson(req);
      const name = cleanName(b.name), email = cleanEmail(b.email), pw = String(b.password || '');
      if (!name) return fail(req, res, 400, 'name', 'Enter your name.');
      if (!validEmail(email)) return fail(req, res, 400, 'email', 'Enter a valid email address.');
      if (pw.length < 8 || pw.length > 200) return fail(req, res, 400, 'password', 'Use at least 8 characters for your password.');
      if (Object.values(store.db.users).some((u) => u.email === email)) return fail(req, res, 409, 'email_taken', 'That email already has an account. Sign in instead.');
      const user = { id: crypto.randomUUID(), email, name, role: first ? 'admin' : 'family', pw: await hashPassword(pw), created: Date.now() };
      store.db.users[user.id] = user; store.flush();
      log('account created', user.role);
      return json(req, res, 200, { user: publicUser(user) }, { 'Set-Cookie': startSession(req, res, user, true) });
    }

    if (p === '/api/login' && method === 'POST') {
      const wait0 = bump(hits, 'auth|' + ip, 30, 60000);
      if (wait0) return fail(req, res, 429, 'rate_limited', 'Too many attempts. Try again in ' + wait0 + ' seconds.', { retryAfter: wait0 });
      const b = await readJson(req);
      const email = cleanEmail(b.email), pw = String(b.password || '').slice(0, 200);
      const key = ip + '|' + email;
      const f = fails.get(key);
      if (f && f.until > Date.now()) {
        const s = Math.ceil((f.until - Date.now()) / 1000);
        return fail(req, res, 429, 'rate_limited', 'Too many attempts. Try again in ' + s + ' seconds.', { retryAfter: s });
      }
      const user = Object.values(store.db.users).find((u) => u.email === email);
      const good = await checkPassword(pw, user ? user.pw : '');
      if (!user || !good) {
        const e = f || { n: 0, until: 0, last: 0 };
        e.n++; e.last = Date.now();
        if (e.n >= 5) { e.n = 0; e.until = Date.now() + 30000; }
        fails.set(key, e);
        log('failed sign-in');
        return fail(req, res, 401, 'invalid_credentials', 'Email or password is incorrect.');
      }
      fails.delete(key);
      if (user.totp && user.totp.on) {
        const t = crypto.randomBytes(24).toString('base64url');
        tickets.set(sha(t), { uid: user.id, exp: Date.now() + 300000, tries: 0, keep: b.keep !== false });
        return json(req, res, 200, { need2fa: true, ticket: t });
      }
      const old = currentSession(req); if (old) { delete store.sessions[old.key]; }
      return json(req, res, 200, { user: publicUser(user) }, { 'Set-Cookie': startSession(req, res, user, b.keep !== false) });
    }

    if (p === '/api/login/2fa' && method === 'POST') {
      const wait0 = bump(hits, 'auth|' + ip, 30, 60000);
      if (wait0) return fail(req, res, 429, 'rate_limited', 'Too many attempts. Try again in ' + wait0 + ' seconds.', { retryAfter: wait0 });
      const b = await readJson(req);
      const k = sha(String(b.ticket || '').slice(0, 100)), tk = tickets.get(k);
      if (!tk || tk.exp < Date.now()) { tickets.delete(k); return fail(req, res, 410, 'expired', 'That took too long. Enter your password again.'); }
      const user = store.db.users[tk.uid];
      if (!user || !check2fa(user, b.code)) {
        tk.tries++; if (tk.tries >= 5) tickets.delete(k);
        return fail(req, res, 401, 'bad_code', tk.tries >= 5 ? 'Too many wrong codes. Enter your password again.' : 'That code isn’t right. Try the newest code from your authenticator app.');
      }
      tickets.delete(k);
      const old = currentSession(req); if (old) { delete store.sessions[old.key]; }
      return json(req, res, 200, { user: publicUser(user) }, { 'Set-Cookie': startSession(req, res, user, tk.keep) });
    }

    /* forgot password: the admin hands out a one-time code (there is no email service here) */
    if (p === '/api/reset' && method === 'POST') {
      const wait0 = bump(hits, 'auth|' + ip, 30, 60000);
      if (wait0) return fail(req, res, 429, 'rate_limited', 'Too many attempts. Try again in ' + wait0 + ' seconds.', { retryAfter: wait0 });
      const b = await readJson(req);
      const email = cleanEmail(b.email), pw = String(b.password || ''), key = 'reset|' + ip + '|' + email;
      const f = fails.get(key);
      if (f && f.until > Date.now()) { const sec = Math.ceil((f.until - Date.now()) / 1000); return fail(req, res, 429, 'rate_limited', 'Too many attempts. Try again in ' + sec + ' seconds.', { retryAfter: sec }); }
      const user = Object.values(store.db.users).find((u) => u.email === email);
      const r = user && store.db.resets && store.db.resets[user.id];
      const good = !!(r && r.exp > Date.now() && timingEq(r.h, sha(normCode(b.code))));
      if (!good) { const e = f || { n: 0, until: 0 }; e.n++; if (e.n >= 5) { e.n = 0; e.until = Date.now() + 60000; } fails.set(key, e); return fail(req, res, 400, 'bad_reset', 'That email and code don’t match, or the code has expired. Ask the admin for a new one.'); }
      if (pw.length < 8 || pw.length > 200) return fail(req, res, 400, 'password', 'Use at least 8 characters for your new password.');
      user.pw = await hashPassword(pw);
      if (r.clear2fa) delete user.totp;
      delete store.db.resets[user.id];
      for (const k of Object.keys(store.sessions)) if (store.sessions[k].uid === user.id) delete store.sessions[k];
      fails.delete(key); store.flush(); log('password reset used');
      return json(req, res, 200, { ok: true, twofa: !!(user.totp && user.totp.on) });
    }

    if (p === '/api/tv/start' && method === 'POST') {
      const wait = bump(hits, 'tvs|' + ip, 10, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Too many attempts. Try again in ' + wait + ' seconds.', { retryAfter: wait });
      if (!userCount()) return fail(req, res, 409, 'no_accounts', 'Create an account on a phone or computer first.');
      tvSweep(); if (tvPending.size >= 50) return fail(req, res, 429, 'busy', 'Too many pairing requests. Try again in a few minutes.');
      let code; do { code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } while (tvFind(code));
      const secret = crypto.randomBytes(24).toString('base64url');
      tvPending.set(sha(secret), { code, exp: Date.now() + 300000, uid: null, ip, at: Date.now() });
      return json(req, res, 200, { code, secret, expiresIn: 300 });
    }
    if (p === '/api/tv/poll' && method === 'POST') {
      const wait = bump(hits, 'tvp|' + ip, 120, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Too many requests.', { retryAfter: wait });
      const b = await readJson(req);
      const k = sha(String(b.secret || '').slice(0, 100)), e = tvPending.get(k);
      if (!e || e.exp < Date.now() || e.ip !== ip) { if (e) tvPending.delete(k); return fail(req, res, 410, 'expired', 'That code has expired. Get a new one.'); }
      if (!e.uid) return json(req, res, 200, { pending: true });
      const user = store.db.users[e.uid]; tvPending.delete(k);
      if (!user) return fail(req, res, 410, 'expired', 'That code has expired. Get a new one.');
      log('TV paired');
      return json(req, res, 200, { user: publicUser(user) }, { 'Set-Cookie': startSession(req, res, user, true) });
    }

    /* everything below needs a signed-in user */
    const sess = currentSession(req);
    if (!sess) return fail(req, res, 401, 'signed_out', 'Please sign in.');
    const me = sess.user;

    if (p === '/api/logout' && method === 'POST') {
      delete store.sessions[sess.key]; store.saveSessions();
      return json(req, res, 200, { ok: true }, { 'Set-Cookie': clearCookie(req) });
    }
    if (p === '/api/rev' && method === 'GET') return json(req, res, 200, { rev: store.db.rev });
    if (p === '/api/events' && method === 'GET') {
      if (!ha) return fail(req, res, 404, 'no_adapter', 'No device connection is set up on this server.');
      if (sse.size >= 40) return fail(req, res, 429, 'busy', 'Too many live connections.');
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
      res.write('retry: 3000\n\nevent: live\ndata: ' + JSON.stringify({ ok: live.ok }) + '\n\n');
      sse.add(res); req.on('close', () => sse.delete(res));
      return;
    }

    if (p === '/api/profile' && method === 'POST') {
      const name = cleanName((await readJson(req)).name);
      if (!name) return fail(req, res, 400, 'name', 'Enter your name.');
      me.name = name; store.flush();
      return json(req, res, 200, { user: publicUser(me) });
    }
    if (p === '/api/password' && method === 'POST') {
      const b = await readJson(req);
      const old = String(b.old || ''), next = String(b.new || '');
      if (!(await checkPassword(old, me.pw))) return fail(req, res, 403, 'wrong_password', 'Current password is incorrect.');
      if (next.length < 8 || next.length > 200) return fail(req, res, 400, 'password', 'Use at least 8 characters.');
      me.pw = await hashPassword(next);
      for (const k of Object.keys(store.sessions)) if (store.sessions[k].uid === me.id && k !== sess.key) delete store.sessions[k];
      store.flush();
      return json(req, res, 200, { ok: true });
    }
    if (p === '/api/delete-account' && method === 'POST') {
      const others = Object.values(store.db.users).filter((u) => u.id !== me.id);
      if (me.role === 'admin' && !Object.values(store.db.users).some((u) => u.id !== me.id && u.role === 'admin') && others.length)
        return fail(req, res, 409, 'last_admin', 'You are the only admin. Remove the other members first.');
      delete store.db.users[me.id];
      for (const k of Object.keys(store.sessions)) if (store.sessions[k].uid === me.id) delete store.sessions[k];
      if (!Object.keys(store.db.users).length) { store.db.data = {}; store.db.rev++; }
      store.flush();
      return json(req, res, 200, { ok: true }, { 'Set-Cookie': clearCookie(req) });
    }

    /* two-step sign-in setup */
    if (p === '/api/2fa/setup' && method === 'POST') {
      const b = await readJson(req);
      if (!(await checkPassword(String(b.password || ''), me.pw))) return fail(req, res, 403, 'wrong_password', 'Password is incorrect.');
      const secret = b32enc(crypto.randomBytes(20));
      me.totpPending = { secret, exp: Date.now() + 900000 };
      return json(req, res, 200, { secret: secret.match(/.{1,4}/g).join(' '), uri: 'otpauth://totp/Lumora:' + encodeURIComponent(me.email) + '?secret=' + secret + '&issuer=Lumora&digits=6&period=30' });
    }
    if (p === '/api/2fa/enable' && method === 'POST') {
      const b = await readJson(req), pend = me.totpPending;
      if (!pend || pend.exp < Date.now()) return fail(req, res, 400, 'no_setup', 'Start the setup again.');
      const c = totpMatch(pend.secret, b.code, 0);
      if (c === null) return fail(req, res, 400, 'bad_code', 'That code isn’t right. Check the time on your phone and try the newest code.');
      const codes = Array.from({ length: 8 }, () => randomCode(8));
      me.totp = { secret: pend.secret, on: true, last: c, rec: codes.map((x) => sha(x)) }; delete me.totpPending;
      for (const k of Object.keys(store.sessions)) if (store.sessions[k].uid === me.id && k !== sess.key) delete store.sessions[k];
      store.flush();
      return json(req, res, 200, { ok: true, recovery: codes.map((x) => x.slice(0, 4) + '-' + x.slice(4)) });
    }
    if (p === '/api/2fa/disable' && method === 'POST') {
      const b = await readJson(req);
      if (!(await checkPassword(String(b.password || ''), me.pw))) return fail(req, res, 403, 'wrong_password', 'Password is incorrect.');
      if (me.totp && me.totp.on && !check2fa(me, b.code)) return fail(req, res, 400, 'bad_code', 'Enter a current code or a recovery code to turn this off.');
      delete me.totp; delete me.totpPending; store.flush();
      return json(req, res, 200, { ok: true });
    }

    /* automations on the server */
    if (p === '/api/automations/log' && method === 'GET') return json(req, res, 200, { log: autoLog.slice(0, 60) });
    const am = p.match(/^\/api\/automations\/([A-Za-z0-9_-]{1,40})\/run$/);
    if (am && method === 'POST') {
      if (roleOf(me) === 'guest' || !auto) return fail(req, res, 403, 'forbidden', 'Your account can’t do that.');
      const okRun = await auto.runById(am[1]);
      return json(req, res, 200, { ok: !!okRun });
    }

    /* usage history */
    if (p === '/api/history' && method === 'GET') {
      if (roleOf(me) === 'guest') return fail(req, res, 403, 'forbidden', 'Your account can’t see history.');
      const n = Math.max(1, Math.min(60, Number(url.searchParams.get('days')) || 14));
      return json(req, res, 200, historyView(n));
    }

    /* saved data */
    let m;
    if ((m = p.match(/^\/api\/data\/([a-z-]{3,30})$/))) {
      const key = m[1];
      if (!SYNC_KEYS.has(key)) return fail(req, res, 400, 'bad_key', 'Unknown key.');
      if (method !== 'GET' && !keyWrite(me, key)) return fail(req, res, 403, 'forbidden', 'Your account can’t change that.');
      if (method === 'PUT') {
        const b = await readJson(req);
        if (typeof b.value !== 'string' || b.value.length > MAX_VALUE) return fail(req, res, 400, 'bad_value', 'Value must be text under 512 KB.');
        try { JSON.parse(b.value); } catch (e) { return fail(req, res, 400, 'bad_value', 'Value must be valid JSON.'); }
        store.db.data[key] = b.value; store.db.rev++; store.saveDb();
        if (key === 'hub-presence' && auto) setTimeout(() => auto.onPresence(), 50);
        return json(req, res, 200, { ok: true, rev: store.db.rev });
      }
      if (method === 'DELETE') {
        delete store.db.data[key]; store.db.rev++; store.saveDb();
        return json(req, res, 200, { ok: true, rev: store.db.rev });
      }
      return fail(req, res, 405, 'method', 'Method not allowed.');
    }

    /* household members (admin only) */
    if (p.startsWith('/api/admin/')) {
      if (me.role !== 'admin') return fail(req, res, 403, 'admin_only', 'Only the admin can do that.');
      if (p === '/api/admin/users' && method === 'GET')
        return json(req, res, 200, { users: Object.values(store.db.users).map((u) => ({ ...publicUser(u), created: u.created })), allowSignup: cfg.allowSignup });
      if (p === '/api/admin/users' && method === 'POST') {
        const b = await readJson(req);
        const name = cleanName(b.name), email = cleanEmail(b.email), pw = String(b.password || '');
        if (!name) return fail(req, res, 400, 'name', 'Enter a name.');
        if (!validEmail(email)) return fail(req, res, 400, 'email', 'Enter a valid email address.');
        if (pw.length < 8 || pw.length > 200) return fail(req, res, 400, 'password', 'Use at least 8 characters for the password.');
        if (Object.values(store.db.users).some((u) => u.email === email)) return fail(req, res, 409, 'email_taken', 'That email already has an account.');
        if (userCount() >= 20) return fail(req, res, 400, 'limit', 'A household can have up to 20 members.');
        const role = ['admin', 'family', 'guest'].includes(b.role) ? b.role : 'family';
        const user = { id: crypto.randomUUID(), email, name, role, pw: await hashPassword(pw), created: Date.now() };
        if (role === 'family' && b.money === true) user.money = true;
        store.db.users[user.id] = user; store.flush();
        return json(req, res, 200, { user: publicUser(user) });
      }
      if ((m = p.match(/^\/api\/admin\/users\/([0-9a-f-]{36})$/)) && method === 'PATCH') {
        const u = store.db.users[m[1]]; if (!u) return fail(req, res, 404, 'not_found', 'No such member.');
        const b = await readJson(req);
        if (b.role !== undefined) {
          if (!['admin', 'family', 'guest'].includes(b.role)) return fail(req, res, 400, 'role', 'Choose admin, family or guest.');
          if (roleOf(u) === 'admin' && b.role !== 'admin' && !Object.values(store.db.users).some((x) => x.id !== u.id && roleOf(x) === 'admin')) return fail(req, res, 409, 'last_admin', 'There has to be at least one admin.');
          u.role = b.role;
        }
        if (typeof b.money === 'boolean') u.money = b.money;
        store.flush();
        return json(req, res, 200, { user: publicUser(u) });
      }
      if ((m = p.match(/^\/api\/admin\/users\/([0-9a-f-]{36})\/reset$/)) && method === 'POST') {
        const u = store.db.users[m[1]]; if (!u) return fail(req, res, 404, 'not_found', 'No such member.');
        const code = randomCode(8); store.db.resets = store.db.resets || {};
        store.db.resets[u.id] = { h: sha(code), exp: Date.now() + 3600000, clear2fa: false }; store.flush();
        return json(req, res, 200, { code: code.slice(0, 4) + '-' + code.slice(4), minutes: 60 });
      }
      if ((m = p.match(/^\/api\/admin\/users\/([0-9a-f-]{36})\/twofa-off$/)) && method === 'POST') {
        const u = store.db.users[m[1]]; if (!u) return fail(req, res, 404, 'not_found', 'No such member.');
        delete u.totp; delete u.totpPending; store.flush();
        return json(req, res, 200, { ok: true });
      }
      if ((m = p.match(/^\/api\/admin\/users\/([0-9a-f-]{36})$/)) && method === 'DELETE') {
        const u = store.db.users[m[1]];
        if (!u) return fail(req, res, 404, 'not_found', 'No such member.');
        if (u.id === me.id) return fail(req, res, 400, 'self', 'You can’t remove yourself here.');
        delete store.db.users[u.id];
        for (const k of Object.keys(store.sessions)) if (store.sessions[k].uid === u.id) delete store.sessions[k];
        store.flush();
        return json(req, res, 200, { ok: true });
      }
      return fail(req, res, 404, 'not_found', 'Not found.');
    }

    /* real lights */
    if (p.startsWith('/api/devices/') || p.startsWith('/api/notify/') || p.startsWith('/api/cameras') || p.startsWith('/api/others/')) {
      if (!ha) return fail(req, res, 404, 'no_adapter', 'No device connection is set up on this server.');
      const wait = p.startsWith('/api/cameras/') ? bump(hits, 'cam|' + me.id, 1800, 60000) : bump(hits, 'dev|' + me.id, 600, 60000);
      if (wait) return fail(req, res, 429, 'rate_limited', 'Slow down a little.', { retryAfter: wait });
      const role = roleOf(me);
      if ((p.startsWith('/api/notify/') || p === '/api/devices/diagnose') && role !== 'admin') return fail(req, res, 403, 'admin_only', 'Only the admin can do that.');
      if ((p.startsWith('/api/cameras') || p === '/api/devices/discover' || p === '/api/others/discover') && role === 'guest') return fail(req, res, 403, 'forbidden', 'Your account can’t do that.');
      try {
      if (p === '/api/others/discover' && method === 'GET') return json(req, res, 200, { others: (await ha.others()).slice(0, 200) });
      if (p === '/api/others/state' && method === 'POST') {
        const b = await readJson(req);
        const ids = Array.isArray(b.ids) ? b.ids.filter((x) => ha.isOtherId(x)).slice(0, 100) : [];
        return json(req, res, 200, { states: Object.fromEntries((await ha.others(ids)).map((o) => [o.id, o])) });
      }
      if ((m = p.match(/^\/api\/others\/([a-z0-9_.]{1,110})\/set$/)) && method === 'POST') {
        const id = m[1];
        if (!ha.isOtherId(id)) return fail(req, res, 400, 'bad_id', 'That is not a supported device.');
        if (id.startsWith('lock.') && role === 'guest') return fail(req, res, 403, 'forbidden', 'Guests can’t use locks.');
        const b = await readJson(req), patch = {};
        if (typeof b.on === 'boolean') patch.on = b.on;
        if (typeof b.locked === 'boolean') patch.locked = b.locked;
        if (Number.isFinite(b.target)) patch.target = b.target;
        if (typeof b.mode === 'string') patch.mode = b.mode;
        if (!Object.keys(patch).length) return fail(req, res, 400, 'empty', 'Nothing to change.');
        await ha.setOther(id, patch);
        return json(req, res, 200, { ok: true });
      }
      if (p === '/api/devices/diagnose' && method === 'GET') return json(req, res, 200, await ha.diagnose());
      if (p === '/api/notify/services' && method === 'GET') {
        return json(req, res, 200, { services: await ha.notifyServices() });
      }
      if (p === '/api/notify/test' && method === 'POST') {
        const b = await readJson(req);
        const phoneOk = ha.isNotifyId(b.smsService) && /^\+[1-9][0-9]{7,14}$/.test(String(b.phone || ''));
        if (!ha.isNotifyId(b.service) && !phoneOk) return fail(req, res, 400, 'bad_service', 'Choose a phone or add a text message number first.');
        if (ha.isNotifyId(b.service)) await ha.notify(b.service, 'Lumora', 'This is a test. Phone alerts are working.');
        if (phoneOk) await ha.notify(b.smsService, 'Lumora', 'This is a test. Text alerts are working.', b.phone);
        return json(req, res, 200, { ok: true });
      }
      if (p === '/api/cameras' && method === 'GET') return json(req, res, 200, { cameras: (await ha.cameras()).slice(0, 50) });
      if ((m = p.match(/^\/api\/cameras\/(camera\.[a-z0-9_]{1,100})\/image$/)) && method === 'GET') {
        const img = await ha.cameraImage(m[1]);
        res.writeHead(200, { 'Content-Type': img.type, 'Content-Length': img.body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return res.end(img.body);
      }
        if (p === '/api/devices/discover' && method === 'GET') {
          const known = String(url.searchParams.get('known') || '').split(',').filter((x) => ha.isLightId(x)).slice(0, 100);
          return json(req, res, 200, { lights: (await ha.discover(known)).slice(0, 100) });
        }
        if (p === '/api/devices/state' && method === 'POST') {
          const b = await readJson(req);
          const ids = Array.isArray(b.ids) ? b.ids.filter((x) => ha.isLightId(x)).slice(0, 100) : [];
          return json(req, res, 200, { states: await ha.states(ids) });
        }
        if ((m = p.match(/^\/api\/devices\/([a-z0-9_.]{1,110})\/set$/)) && method === 'POST') {
          const id = m[1];
          if (!ha.isLightId(id)) return fail(req, res, 400, 'bad_id', 'That is not a light.');
          const b = await readJson(req), patch = {};
          if (typeof b.on === 'boolean') patch.on = b.on;
          if (Number.isFinite(b.bri)) patch.bri = b.bri;
          if (Number.isFinite(b.temp)) patch.temp = b.temp;
          if (typeof b.color === 'string' && /^#[0-9a-f]{6}$/i.test(b.color)) patch.color = b.color;
          if (!Object.keys(patch).length) return fail(req, res, 400, 'empty', 'Nothing to change.');
          await ha.setLight(id, patch);
          return json(req, res, 200, { ok: true });
        }
      } catch (e) {
        if (e.message === 'bad json' || e.message === 'too large') throw e;
        log('device error:', e.message);
        return fail(req, res, e.status || 502, 'device_error', e.message);
      }
      return fail(req, res, 404, 'not_found', 'Not found.');
    }

    return fail(req, res, 404, 'not_found', 'Not found.');
  }

  /* ---------- static ---------- */
  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    let p;
    try { p = decodeURIComponent(url.pathname); } catch (e) { return send(req, res, 400, 'Bad request'); }
    if (p === '/' || p === '') p = '/index.html';
    if (p.includes('\0') || p.split('/').some((s) => s === '..' || s.startsWith('.'))) return send(req, res, 404, 'Not found');
    const f = statics.get(p);
    if (!f) return send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const noCache = f.name === 'index.html' || f.name === 'sw.js' || f.ext === '.webmanifest';
    const h = { 'Content-Type': f.type, 'Cache-Control': noCache ? 'no-cache' : 'public, max-age=86400', Vary: 'Accept-Encoding' };
    let body = f.buf;
    if (f.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) { body = f.gz; h['Content-Encoding'] = 'gzip'; }
    h['Content-Length'] = body.length;
    res.writeHead(200, secHeaders(req, h));
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  const server = http.createServer(async (req, res) => {
    const t0 = Date.now();
    res.on('finish', () => log(clientIp(req), req.method, String(req.url).split('?')[0], res.statusCode, (Date.now() - t0) + 'ms'));
    let url;
    try { url = new URL(req.url, 'http://x'); } catch (e) { return send(req, res, 400, 'Bad request'); }
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else if (url.pathname === '/tv.apk') { res.writeHead(302, { Location: cfg.tvApkUrl || 'https://github.com/seymour6000-beep/lumora-addon/releases/download/tv-latest/Lumora-TV.apk', 'Cache-Control': 'no-store' }); res.end(); }
      else if (url.pathname === '/tv') {
        const host = String(req.headers.host || '').replace(/[^A-Za-z0-9.:\-]/g, '');
        const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumora on your TV</title><style>body{margin:0;font:20px/1.5 system-ui,sans-serif;background:#0d0b1f;color:#f3f1ff;display:grid;place-items:center;min-height:100vh}main{max-width:640px;padding:28px}h1{margin:0 0 6px}code{background:#241f4a;padding:2px 10px;border-radius:8px;font-size:1.05em}ol{padding-left:1.2em}li{margin:12px 0}a.b{display:inline-block;margin-top:10px;background:#7a66ff;color:#fff;padding:12px 22px;border-radius:14px;text-decoration:none;font-weight:700}</style></head><body><main><h1>Lumora on your TV</h1><p>Three steps on Google TV or Android TV.</p><ol><li>Install the free <b>Downloader</b> app from the Play Store on the TV and open it.</li><li>In its address box type <code>' + host + '/tv.apk</code> and choose Go. Then choose Install.</li><li>Open <b>Lumora</b>, choose <b>Find my server automatically</b>, then <b>Sign in with a code from my phone</b>. Approve the code on your phone in Lumora, Settings, Approve a TV.</li></ol><a class="b" href="/tv.apk">Download the TV app</a></main></body></html>';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(html);
      }
      else serveStatic(req, res, url);
    } catch (e) {
      if (res.headersSent) return res.destroy();
      if (e.status === 400) return fail(req, res, 400, 'bad_request', 'That request could not be read.');
      if (e.status === 413) return fail(req, res, 413, 'too_large', 'That is too much data.');
      console.error('Error:', e && e.stack || e);
      fail(req, res, 500, 'server_error', 'Something went wrong on the server.');
    }
  });
  server.headersTimeout = 15000; server.requestTimeout = 30000; server.keepAliveTimeout = 5000;

  return {
    server, store, cfg, hasAdapter: !!ha, checkUpdate,
    parseAlerts, scanSchool, parseForecast, isLanIp, notifyTick, onLiveEvent, live, recordHistory, historyView, saveHistory, auto,
    close() { saveHistory(); if (auto) auto.close(); clearInterval(autoFlush); clearInterval(histTimer); clearInterval(sweepT); clearInterval(tidy); if (recTimer) clearInterval(recTimer); live.closed = true; clearTimeout(live.timer); clearTimeout(nudgeT); clearInterval(sseKeep); if (live.probeTimer) clearInterval(live.probeTimer); try { live.ws && live.ws.close(); } catch (e) { /* ignore */ } for (const r of sse) { try { r.end(); } catch (e) { /* ignore */ } } if (notifyTimer) clearInterval(notifyTimer); if (updTimer) clearInterval(updTimer); if (updFirst) clearTimeout(updFirst); store.flush(); return new Promise((r) => server.close(() => r())); },
  };
}

module.exports = { createApp, loadConfig, SYNC_KEYS };

if (require.main === module) {
  const cfg = loadConfig();
  const app = createApp(cfg);
  app.server.listen(cfg.port, cfg.host, () => {
    console.log('Lumora ' + VERSION + ' is running at http://' + (cfg.host === '0.0.0.0' ? 'localhost' : cfg.host) + ':' + cfg.port);
    console.log('Data folder: ' + cfg.dataDir);
    console.log('Lights: ' + (app.hasAdapter ? 'Home Assistant at ' + cfg.haUrl : 'demo (set HA_URL and HA_TOKEN to control real lights)'));
    if (cfg.cookieSecure === 'auto' && !cfg.trustProxy) console.log('Tip: put this behind HTTPS (see README) before using it away from home.');
  });
  const stop = () => { console.log('Shutting down…'); app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  /* a home hub should keep running: log a surprise and carry on instead of dropping every light control */
  process.on('uncaughtException', (e) => console.error('Uncaught:', e && e.stack || e));
  process.on('unhandledRejection', (e) => console.error('Unhandled:', e && e.stack || e));
}
