'use strict';
/* Lumora automation engine: runs the household's automations on the server, so they work with every browser closed.
   Rules are the same objects the web app saves in "hub-rules". The browser stands aside for the trigger types listed in SERVER_TYPES. */

const SERVER_TYPES = ['time', 'sun', 'lefton', 'lightoff', 'sensor', 'lockev', 'temp', 'home', 'away', 'manual', 'interval', 'alarm', 'sleepstart', 'sleepend'];
const BUILTIN = { Evening: { on: true, bri: 45, color: '#ffb35c' }, Movie: { on: true, bri: 12, color: '#8fc1ff' }, Bright: { on: true, bri: 100, color: '#fff1d6' }, 'All off': { on: false } };
const AMHERST = { lat: 45.8167, lon: -64.2167 };

/* sunrise and sunset in minutes after local midnight (same maths as the web app) */
function sunMinutes(dateParts, tzOffsetMin, lat, lon) {
  const rad = Math.PI / 180;
  const doy = Math.round((Date.UTC(dateParts.y, dateParts.mo - 1, dateParts.d) - Date.UTC(dateParts.y, 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (doy - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const c = (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
  if (c > 1 || c < -1) return { none: true, up: c < -1 };
  const ha = Math.acos(c) / rad, m = (v) => ((Math.round(v) % 1440) + 1440) % 1440;
  return { rise: m(720 - 4 * (lon + ha) - eq + tzOffsetMin), set: m(720 - 4 * (lon - ha) - eq + tzOffsetMin) };
}

function create({ ha, readJson, tz, notify, activity, clock = () => Date.now(), onStat, onOtherEvent, hooks = {} }) {
  const lightsNow = new Map();            // id -> light
  const prevOnline = new Map();           // id -> bool
  const onSince = new Map();              // id -> ms
  const firedLeft = new Set();
  const firedTime = new Set();
  const prevOther = new Map();            // id -> state
  const busy = new Set();
  const timers = new Set();
  let others = {};                         // id -> latest other state
  let stopped = false, lastPresence = null;
  const stats = {};                        // rule id -> { last, count, done }
  const lastEvery = new Map();             // rule id -> ms of the last 'every N minutes' run
  const MEDIA = ['play_pause', 'next', 'previous', 'volume_up', 'volume_down', 'pause', 'play'];

  const fmtParts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
  function local(ms) {
    const o = {}; for (const p of fmtParts.formatToParts(new Date(ms))) o[p.type] = p.value;
    const y = +o.year, mo = +o.month, d = +o.day, h = +o.hour, mi = +o.minute, s = +o.second;
    const asUtc = Date.UTC(y, mo - 1, d, h, mi, s), offset = Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
    const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
    return { y, mo, d, h, mi, min: h * 60 + mi, dow, offset, key: o.year + '-' + o.month + '-' + o.day };
  }
  const settings = () => readJson('hub-settings', {});
  const serverOn = () => settings().serverAuto !== false;
  const place = () => { const st = settings(), la = parseFloat(st.lat), lo = parseFloat(st.lon); return isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? { lat: la, lon: lo } : AMHERST; };
  const sun = (ms) => { const l = local(ms), p = place(); return sunMinutes(l, l.offset, p.lat, p.lon); };
  function isDark(ms) {
    const s = sun(ms), l = local(ms); if (s.none) return !s.up;
    return s.rise < s.set ? (l.min < s.rise || l.min >= s.set) : (l.min >= s.set && l.min < s.rise);
  }
  const toMin = (hm) => { const [h, m] = String(hm || '0:0').split(':'); return (+h || 0) * 60 + (+m || 0); };
  const inRange = (nm, from, to) => { const a = toMin(from), b = toMin(to); return a <= b ? (nm >= a && nm < b) : (nm >= a || nm < b); };
  const rules = () => (readJson('hub-rules', []) || []).filter((r) => r && r.on !== false && r.t && Array.isArray(r.acts) && !(stats[r.id] && stats[r.id].done));
  const presence = () => (readJson('hub-presence', 'home') === 'away' ? 'away' : 'home');
  const nameOf = (id) => { const l = lightsNow.get(id); if (l) return l.name; const o = others[id]; if (o) return o.name; return id; };

  function condOK(c, now) {
    switch (c.k) {
      case 'dark': return isDark(now) === true;
      case 'presence': return presence() === c.v;
      case 'between': return inRange(local(now).min, c.from, c.to);
      case 'lighton': { const d = lightsNow.get(c.id); return !!d && d.online !== false && (!!d.on === (c.v === 'on')); }
      case 'othstate': { const s = others[c.id]; return !!s && (!!s.active === (c.v === 'active')); }
      case 'weekday': { const days = Array.isArray(c.days) && c.days.length ? c.days : [0, 1, 2, 3, 4, 5, 6]; return days.includes(local(now).dow); }
      case 'anyon': { const any = [...lightsNow.values()].some((d) => d.on && d.online !== false); return any === (c.v !== 'off'); }
      case 'alarmmode': { const m = hooks.alarmMode ? hooks.alarmMode() : 'off'; return c.v === 'armed' ? m !== 'off' : m === 'off'; }
    }
    return true;
  }
  const title = (r) => (r.name && String(r.name).trim()) || 'Automation';
  const wait = (ms) => new Promise((res) => { const t = setTimeout(() => { timers.delete(t); res(); }, ms); timers.add(t); if (t.unref) t.unref(); });

  function targets(id, ctx) {
    const all = [...lightsNow.values()];
    if (id === 'all') return all.filter((d) => d.online !== false);
    if (id === '@trigger') { const d = ctx && ctx.light && lightsNow.get(ctx.light); return d ? [d] : []; }
    const d = lightsNow.get(id); return d ? [d] : [];
  }
  function sceneOf(name) {
    const custom = readJson('hub-scenes', {});
    const sc = custom && custom[name] ? custom[name] : (BUILTIN[name] ? { '*': BUILTIN[name] } : null);
    if (!sc) return {};
    if (sc['*']) return Object.fromEntries([...lightsNow.values()].filter((d) => d.online !== false).map((d) => [d.id, sc['*']]));
    return sc;
  }
  async function setLight(id, p) { const d = lightsNow.get(id); if (d && d.online === false && ('on' in p || 'bri' in p)) return; await ha.setLight(id, p); const l = lightsNow.get(id); if (l) Object.assign(l, p); }
  async function fade(d, dir, mins, target) {
    const steps = Math.max(2, Math.min(240, Math.round(mins * 60000 / 5000))), from = dir === 'up' ? 1 : Math.max(1, d.bri || 100), to = dir === 'up' ? Math.max(1, Math.min(100, Math.round(target || 100))) : 1;
    if (dir === 'down' && !d.on) return;
    if (dir === 'up') await setLight(d.id, { on: true, bri: 1 });
    for (let i = 1; i <= steps && !stopped; i++) {
      await wait(mins * 60000 / steps);
      if (i === steps) await setLight(d.id, dir === 'up' ? { bri: to } : { on: false }); else await setLight(d.id, { bri: Math.max(1, Math.round(from + (to - from) * i / steps)) });
    }
  }
  /* {light}, {time} and {rule} in a message are replaced when it is sent */
  const fill = (t, ctx, now) => String(t).replace(/\{light\}/g, ctx && ctx.light ? nameOf(ctx.light) : 'a light').replace(/\{time\}/g, (() => { const l = local(now); return String(l.h).padStart(2, '0') + ':' + String(l.mi).padStart(2, '0'); })()).replace(/\{rule\}/g, (ctx && ctx.rule) || 'Automation').slice(0, 200);
  async function doAct(a, ctx, now) {
    switch (a.k) {
      case 'light':
        for (const d of targets(a.id, ctx)) {
          if (a.op === 'toggle') await setLight(d.id, { on: !d.on });
          else if (a.op === 'on') { await setLight(d.id, { on: true }); if (a.mins > 0) wait(a.mins * 60000).then(() => setLight(d.id, { on: false })).catch(() => {}); }
          else await setLight(d.id, { on: false });
        } break;
      case 'bri': for (const d of targets(a.id, ctx)) await setLight(d.id, { bri: Math.round(a.bri), on: true }); break;
      case 'color': for (const d of targets(a.id, ctx)) await setLight(d.id, { color: a.color, on: true }); break;
      case 'scene': for (const [id, p] of Object.entries(sceneOf(a.name))) await setLight(id, p); break;
      case 'room': { const mine = readJson('hub-lights', []).filter((x) => x && x.room === a.room).map((x) => x.id); for (const d of [...lightsNow.values()].filter((x) => mine.includes(x.id) && x.online !== false)) await setLight(d.id, { on: a.op === 'on' }); break; }
      case 'fadeup': targets(a.id, ctx).forEach((d) => fade(d, 'up', a.mins, a.bri).catch(() => {})); break;
      case 'fadedown': targets(a.id, ctx).forEach((d) => fade(d, 'down', a.mins).catch(() => {})); break;
      case 'notify': { const text = fill(a.text || 'Automation', ctx, now); activity('Notification: ' + text); if (notify) await notify('Lumora', String(text)); break; }
      case 'sleep': if (hooks.sleep) { try { await hooks.sleep(a.mins); } catch (e) { activity('Sleep mode could not start: ' + (e && e.message)); } } break;
      case 'media': if (hooks.media && MEDIA.includes(a.op)) { try { await hooks.media(a.op); } catch (e) { activity('Music: ' + (e && e.message)); } } break;
      case 'alarm': if (hooks.alarm && (a.mode === 'home' || a.mode === 'away')) hooks.alarm(a.mode); break;   /* automations arm the alarm, they never disarm it */
      case 'wait': await wait(Math.min(3600, (a.unit === 'm' ? 60 : 1) * (+a.n || 0)) * 1000); break;
      case 'plug': case 'therm': case 'lock': {
        const kind = { plug: 'switch.', therm: 'climate.', lock: 'lock.' }[a.k];
        const ids = a.id === 'all' ? Object.keys(others).filter((i) => i.startsWith(kind)) : [a.id];
        for (const id of ids) {
          if (!ha.isOtherId(id)) continue;
          if (a.k === 'plug') await ha.setOther(id, { on: a.op === 'toggle' ? !(others[id] && others[id].on) : a.op === 'on' });
          else if (a.k === 'therm') await ha.setOther(id, { target: +a.target });
          else await ha.setOther(id, { locked: true });   /* automations lock, they never unlock */
        } break;
      }
    }
  }
  async function run(r, ctx = {}, force = false) {
    if (stopped || !ha) return false;
    const now = clock();
    if (!force) {
      if (settings().pauseAll) return false;
      const bad = (r.c || []).find((c) => !condOK(c, now));
      if (bad) { activity('Skipped “' + title(r) + '”: a condition was not met'); return false; }
    }
    if (!force && +r.cool > 0 && stats[r.id] && stats[r.id].last && now - stats[r.id].last < Math.min(1440, +r.cool) * 60000) return false;   /* wait-between-runs */
    if (busy.has(r.id)) return false;
    busy.add(r.id); ctx = Object.assign({ rule: title(r) }, ctx);
    try { for (const a of r.acts) await doAct(a, ctx, now); }
    catch (e) { activity('Automation problem: ' + title(r) + ' (' + (e && e.message) + ')'); }
    finally { busy.delete(r.id); }
    const s = stats[r.id] = stats[r.id] || { count: 0 };
    s.last = clock(); s.count = (s.count || 0) + 1; if (r.once && !force) s.done = true;
    activity('Automation ran: ' + title(r) + (ctx.light ? ' (' + nameOf(ctx.light) + ')' : ''));
    if (onStat) onStat(stats);
    return true;
  }
  const fire = (type, ctx, match) => { if (!serverOn()) return; for (const r of rules()) if (r.t.type === type && (!match || match(r))) run(r, ctx).catch(() => {}); };

  /* ---- inputs ---- */
  function onLights(lights) {
    if (stopped) return;
    const now = clock(), first = lightsNow.size === 0 && prevOnline.size === 0;
    const incoming = new Map(lights.map((l) => [l.id, l]));
    for (const id of [...lightsNow.keys()]) if (!incoming.has(id)) lightsNow.delete(id);
    for (const l of lights) {
      lightsNow.set(l.id, { ...l });
      const was = prevOnline.get(l.id);
      if (!first && was === true && l.online === false) fire('lightoff', { light: l.id });
      prevOnline.set(l.id, l.online !== false);
      if (l.on && l.online !== false) { if (!onSince.has(l.id)) onSince.set(l.id, now); }
      else { onSince.delete(l.id); for (const k of [...firedLeft]) if (k.endsWith('|' + l.id)) firedLeft.delete(k); }
    }
    if (!serverOn()) return;
    for (const r of rules()) if (r.t.type === 'lefton') {
      for (const [id, since] of onSince) { const k = r.id + '|' + id; if (now - since >= (+r.t.mins || 60) * 60000 && !firedLeft.has(k)) { firedLeft.add(k); run(r, { light: id }).catch(() => {}); } }
    }
  }
  function onOther(s) {
    if (stopped || !s || !s.id) return;
    const a = prevOther.get(s.id); others[s.id] = s; prevOther.set(s.id, s);
    if (!a) return;
    if (onOtherEvent) { try { onOtherEvent(s, a); } catch (e) { /* never block automations */ } }
    if (s.kind === 'sensor' && a.active !== s.active) fire('sensor', { id: s.id, ev: s.active ? 'on' : 'off' }, (r) => (r.t.id === 'any' || r.t.id === s.id) && r.t.ev === (s.active ? 'on' : 'off'));
    if (s.kind === 'lock' && a.locked !== s.locked) fire('lockev', { id: s.id }, (r) => (r.t.id === 'any' || r.t.id === s.id) && r.t.ev === (s.locked ? 'locked' : 'unlocked'));
    if (s.kind === 'thermostat' && a.temp != null && s.temp != null && a.temp !== s.temp) {
      fire('temp', { dev: s.id }, (r) => { if (r.t.id !== 'any' && r.t.id !== s.id) return false; const lim = +r.t.deg, hit = (v) => (r.t.dir === 'above' ? v > lim : v < lim); return !hit(a.temp) && hit(s.temp); });
    }
  }
  let othersBusy = false;
  async function pollOthers() {
    if (stopped || !ha || othersBusy) return; othersBusy = true;
    try {
      const need = (readJson('hub-others', []) || []).map((x) => x && x.id).filter((i) => ha.isOtherId(i));
      if (!need.length) return;
      for (const s of await ha.others(need.slice(0, 100))) onOther(s);
    } catch (e) { /* next time */ } finally { othersBusy = false; }
  }
  function tick() {
    if (stopped || !serverOn()) return;
    const now = clock(), l = local(now), p = presence();
    if (lastPresence === null) lastPresence = p; else if (p !== lastPresence) { lastPresence = p; fire(p === 'away' ? 'away' : 'home', {}); }
    let s = null;
    for (const r of rules()) {
      if (r.t.type === 'time') {
        const days = Array.isArray(r.t.days) && r.t.days.length ? r.t.days : [0, 1, 2, 3, 4, 5, 6];
        const k = r.id + '|' + l.key + '|' + r.t.at;
        if (toMin(r.t.at) === l.min && days.includes(l.dow) && !firedTime.has(k)) { firedTime.add(k); run(r).catch(() => {}); }
      } else if (r.t.type === 'interval') {
        const every = Math.max(1, Math.min(1440, Math.round(+r.t.every) || 60)) * 60000;
        if (!lastEvery.has(r.id)) lastEvery.set(r.id, now); else if (now - lastEvery.get(r.id) >= every) { lastEvery.set(r.id, now); run(r).catch(() => {}); }
      } else if (r.t.type === 'sun') {
        s = s || sun(now); if (s.none) continue;
        const at = ((((r.t.which === 'sunrise' ? s.rise : s.set) + Math.round(+r.t.off || 0)) % 1440) + 1440) % 1440;
        const k = r.id + '|' + l.key + '|sun';
        if (at === l.min && !firedTime.has(k)) { firedTime.add(k); run(r).catch(() => {}); }
      }
    }
    if (firedTime.size > 2000) firedTime.clear();
  }
  const timer = setInterval(tick, 10000); if (timer.unref) timer.unref();
  const oTimer = setInterval(pollOthers, 5000); if (oTimer.unref) oTimer.unref();

  return {
    SERVER_TYPES, run, onLights, onOther, tick, pollOthers, isDark, sun, local, condOK,
    onPresence() { tick(); },
    fireEvent(type, ctx) { if (['alarm', 'sleepstart', 'sleepend'].includes(type)) fire(type, ctx || {}); },
    runById: (id) => { const r = (readJson('hub-rules', []) || []).find((x) => x && x.id === id && Array.isArray(x.acts)); return r ? run(r, {}, true) : Promise.resolve(false); },
    setStats(s) { Object.assign(stats, s || {}); },
    stats: () => stats,
    close() { stopped = true; clearInterval(timer); clearInterval(oTimer); for (const t of timers) clearTimeout(t); timers.clear(); },
  };
}

module.exports = { create, SERVER_TYPES, sunMinutes };
