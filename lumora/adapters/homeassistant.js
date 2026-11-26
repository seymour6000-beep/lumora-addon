'use strict';
/* Talks to Home Assistant's REST API (https://developers.home-assistant.io/docs/api/rest/).
   Any light Home Assistant can see (Lepro, Hue, LIFX, Govee, ...) shows up in Lumora through this. */

const LIGHT_ID = /^light\.[a-z0-9_]{1,100}$/;
const CAMERA_ID = /^camera\.[a-z0-9_]{1,100}$/;
const OTHER_ID = /^(switch|binary_sensor|climate|lock)\.[a-z0-9_]{1,100}$/;
const SENSOR_CLASSES = { motion: 'Motion', occupancy: 'Occupancy', presence: 'Presence', door: 'Door', window: 'Window', garage_door: 'Garage door', opening: 'Opening', smoke: 'Smoke', moisture: 'Water leak', gas: 'Gas', carbon_monoxide: 'Carbon monoxide', vibration: 'Vibration', tamper: 'Tamper', safety: 'Safety', sound: 'Sound' };
const NOTIFY_ID = /^notify\.[a-z0-9_]{1,100}$/;

function create({ url, token, fetchImpl = globalThis.fetch, timeoutMs = 8000, probes = () => ({}) }) {
  if (!url || !token) throw new Error('HA_URL and HA_TOKEN are both required');
  const base = String(url).replace(/\/+$/, '');

  async function req(path, opts = {}) {
    let res;
    try {
      res = await fetchImpl(base + path, {
        ...opts,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw Object.assign(new Error('Could not reach Home Assistant'), { status: 502, cause: e });
    }
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Home Assistant rejected the access token'), { status: 502 });
    if (!res.ok) throw Object.assign(new Error('Home Assistant returned ' + res.status), { status: 502 });
    if (res.status === 204) return null;
    return res.json();
  }

  const hex = (rgb) => '#' + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');

  function mapLight(s) {
    const a = s.attributes || {};
    const online = s.state !== 'unavailable' && s.state !== 'unknown';
    const on = s.state === 'on';
    const out = {
      id: s.entity_id,
      name: (String(a.friendly_name || s.entity_id).replace(/[<>&"']/g, '').replace(/\s+bulb\s*$/i, '').trim() || s.entity_id).slice(0, 30),
      room: 'Home',
      on,
      online,
      bri: a.brightness != null ? Math.max(1, Math.min(100, Math.round((a.brightness / 255) * 100))) : 100,
      color: Array.isArray(a.rgb_color) && a.rgb_color.length === 3 ? hex(a.rgb_color) : '#fff1d6',
    };
    if (a.color_temp_kelvin) out.temp = a.color_temp_kelvin;
    return out;
  }

  async function allLights() {
    const states = await req('/api/states');
    if (!Array.isArray(states)) throw Object.assign(new Error('Unexpected reply from Home Assistant'), { status: 502 });
    const by = new Map(states.filter((s) => s && s.entity_id).map((s) => [s.entity_id, s]));
    let pm = {}; try { pm = probes() || {}; } catch (e) { pm = {}; }
    return states.filter((s) => s && LIGHT_ID.test(String(s.entity_id))).map((s) => {
      const l = mapLight(s);
      /* some bulbs never report "unavailable" when unplugged: a connectivity sensor (such as Home Assistant's Ping) can say it for them */
      const sensor = pm[l.id] && by.get(pm[l.id]);
      if (sensor && l.online && (sensor.state === 'off' || sensor.state === 'unavailable' || sensor.state === 'unknown')) l.online = false;
      return l;
    });
  }

  const cleanName = (s, id) => (String(((s.attributes || {}).friendly_name) || id).replace(/[<>&"']/g, '').trim() || id).slice(0, 40);
  let unit = null;
  async function tempUnit() {
    if (unit) return unit;
    try { const c = await req('/api/config'); unit = (c && c.unit_system && /F/i.test(c.unit_system.temperature)) ? '°F' : '°C'; } catch (e) { unit = '°C'; }
    return unit;
  }
  const numOrNull = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  /* plugs, door/motion sensors, thermostats and locks */
  function mapOther(s, u) {
    const a = s.attributes || {}, dom = String(s.entity_id).split('.')[0];
    const online = s.state !== 'unavailable' && s.state !== 'unknown';
    const o = { id: s.entity_id, name: cleanName(s, s.entity_id), online };
    if (dom === 'switch') { o.kind = 'plug'; o.on = s.state === 'on'; }
    else if (dom === 'binary_sensor') { o.kind = 'sensor'; o.cls = String(a.device_class || ''); o.label = SENSOR_CLASSES[o.cls] || 'Sensor'; o.active = s.state === 'on'; }
    else if (dom === 'lock') { o.kind = 'lock'; o.locked = s.state === 'locked'; o.state = String(s.state); }
    else if (dom === 'climate') {
      o.kind = 'thermostat'; o.temp = numOrNull(a.current_temperature); o.target = numOrNull(a.temperature); o.mode = String(s.state);
      o.action = a.hvac_action ? String(a.hvac_action) : ''; o.modes = Array.isArray(a.hvac_modes) ? a.hvac_modes.map(String).slice(0, 8) : [];
      o.min = numOrNull(a.min_temp) ?? 7; o.max = numOrNull(a.max_temp) ?? 35; o.step = numOrNull(a.target_temp_step) || (u === '°F' ? 1 : 0.5); o.unit = u;
    }
    o.changed = Date.parse(s.last_changed) || 0;
    return o;
  }
  const wantOther = (s) => {
    if (!s || !OTHER_ID.test(String(s.entity_id))) return false;
    if (String(s.entity_id).startsWith('binary_sensor.')) return Object.prototype.hasOwnProperty.call(SENSOR_CLASSES, String((s.attributes || {}).device_class || ''));
    return true;
  };

  return {
    name: 'homeassistant',
    isOtherId: (id) => OTHER_ID.test(String(id)),
    mapOther,
    async others(ids) {
      const states = await req('/api/states');
      if (!Array.isArray(states)) throw Object.assign(new Error('Unexpected reply from Home Assistant'), { status: 502 });
      const u = await tempUnit(), want = Array.isArray(ids) ? new Set(ids) : null;
      return states.filter((s) => (want ? want.has(s && s.entity_id) && OTHER_ID.test(String(s.entity_id)) : wantOther(s))).map((s) => mapOther(s, u));
    },
    async setOther(id, patch) {
      if (!OTHER_ID.test(String(id))) throw Object.assign(new Error('Not a supported device'), { status: 400 });
      const dom = String(id).split('.')[0], post = (svc, data) => req('/api/services/' + svc, { method: 'POST', body: JSON.stringify({ entity_id: id, ...data }) });
      if (dom === 'switch' && typeof patch.on === 'boolean') return post(patch.on ? 'switch/turn_on' : 'switch/turn_off', {});
      if (dom === 'lock' && typeof patch.locked === 'boolean') return post(patch.locked ? 'lock/lock' : 'lock/unlock', {});
      if (dom === 'climate') {
        if (Number.isFinite(patch.target)) return post('climate/set_temperature', { temperature: Math.max(5, Math.min(40, patch.target)) });
        if (typeof patch.mode === 'string' && /^[a-z_]{2,20}$/.test(patch.mode)) return post('climate/set_hvac_mode', { hvac_mode: patch.mode });
      }
      throw Object.assign(new Error('That device can’t do that'), { status: 400 });
    },
    isLightId: (id) => LIGHT_ID.test(String(id)),
    async ping() { await req('/api/'); return true; },
    isCameraId: (id) => CAMERA_ID.test(String(id)),
    isNotifyId: (id) => NOTIFY_ID.test(String(id)),
    /* people Home Assistant tracks (phones with the companion app): who is home */
    async persons() {
      const states = await req('/api/states');
      if (!Array.isArray(states)) return [];
      return states.filter((s) => s && /^person\./.test(String(s.entity_id))).map((s) => ({ id: s.entity_id, home: s.state === 'home' }));
    },
    async cameras() {
      const states = await req('/api/states');
      if (!Array.isArray(states)) return [];
      return states.filter((s) => s && CAMERA_ID.test(String(s.entity_id)))
        .map((s) => ({ id: s.entity_id, name: String((s.attributes || {}).friendly_name || s.entity_id).replace(/[<>&"']/g, '').slice(0, 40), online: s.state !== 'unavailable' }));
    },
    async cameraImage(id) {
      if (!CAMERA_ID.test(String(id))) throw Object.assign(new Error('Not a camera'), { status: 400 });
      let res;
      try { res = await fetchImpl(base + '/api/camera_proxy/' + id, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(timeoutMs) }); }
      catch (e) { throw Object.assign(new Error('Could not reach Home Assistant'), { status: 502 }); }
      if (!res.ok) throw Object.assign(new Error('Home Assistant returned ' + res.status), { status: 502 });
      const type = String(res.headers.get('content-type') || '');
      if (!/^image\/(jpeg|png|gif|webp)/.test(type)) throw Object.assign(new Error('Not an image'), { status: 502 });
      if (Number(res.headers.get('content-length')) > 8 * 1024 * 1024) throw Object.assign(new Error('Picture too large'), { status: 502 });
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > 8 * 1024 * 1024) throw Object.assign(new Error('Picture too large'), { status: 502 });
      return { type: type.split(';')[0], body };
    },
    /* ask the integrations to re-read these lights now (so a bulb that dropped off is noticed sooner) */
    /* what Home Assistant itself says about each light, and which sensors could vouch for one being online */
    async diagnose() {
      const states = await req('/api/states');
      if (!Array.isArray(states)) return { lights: [], sensors: [] };
      const now = Date.now(); const age = (t) => { const v = Date.parse(t); return Number.isFinite(v) ? Math.max(0, Math.round((now - v) / 1000)) : null; };
      return {
        lights: states.filter((s) => s && LIGHT_ID.test(String(s.entity_id))).map((s) => ({ id: s.entity_id, name: String((s.attributes || {}).friendly_name || s.entity_id).replace(/[<>&"']/g, '').slice(0, 40), state: String(s.state), changedAgo: age(s.last_changed), updatedAgo: age(s.last_updated) })),
        sensors: states.filter((s) => s && /^binary_sensor\.[a-z0-9_]{1,100}$/.test(String(s.entity_id)) && ((s.attributes || {}).device_class === 'connectivity' || /ping|connect|online|wifi|reach/i.test(String(s.entity_id) + ' ' + String((s.attributes || {}).friendly_name || ''))))
          .map((s) => ({ id: s.entity_id, name: String((s.attributes || {}).friendly_name || s.entity_id).replace(/[<>&"']/g, '').slice(0, 50), state: String(s.state) })).slice(0, 100),
      };
    },
    async refresh(ids) {
      const list = (Array.isArray(ids) ? ids : []).filter((x) => LIGHT_ID.test(String(x))).slice(0, 60);
      if (list.length) await req('/api/services/homeassistant/update_entity', { method: 'POST', body: JSON.stringify({ entity_id: list }) });
    },
    async notifyServices() {
      const svc = await req('/api/services');
      const d = Array.isArray(svc) ? svc.find((x) => x && x.domain === 'notify') : null;
      return d && d.services ? Object.keys(d.services).filter((n) => /^[a-z0-9_]{1,100}$/.test(n) && n !== 'send_message' && n !== 'persistent_notification').map((n) => 'notify.' + n) : [];
    },
    async notify(service, title, message, target) {
      if (!NOTIFY_ID.test(String(service))) throw Object.assign(new Error('Not a notify service'), { status: 400 });
      try { await req('/api/services/notify/' + service.slice(7), { method: 'POST', body: JSON.stringify({ title: String(title).slice(0, 100), message: String(message).slice(0, 300), ...(target ? { target: [String(target)] } : {}) }) }); } catch (e) { throw Object.assign(new Error('Home Assistant couldn’t send through ' + service + (e.message ? ' (' + e.message.replace(/^Home Assistant /, '') + ')' : '')), { status: 502, cause: e }); }
    },
    async haComponents() { const c = await req('/api/config'); return Array.isArray(c && c.components) ? c.components : []; },
    async createScene(sceneId, entities) {
      if (!/^[a-z0-9_]{1,60}$/.test(String(sceneId))) throw Object.assign(new Error('Bad scene id'), { status: 400 });
      await req('/api/services/scene/create', { method: 'POST', body: JSON.stringify({ scene_id: sceneId, entities }) });
    },
    allLights,
    async discover(known = []) {
      const skip = new Set(known);
      return (await allLights()).filter((l) => !skip.has(l.id));
    },
    async states(ids) {
      const want = new Set(ids);
      const out = {};
      for (const l of await allLights()) if (want.has(l.id)) out[l.id] = l;
      return out;
    },
    async setLight(id, patch) {
      if (!LIGHT_ID.test(String(id))) throw Object.assign(new Error('Not a light'), { status: 400 });
      if (patch.on === false) {
        await req('/api/services/light/turn_off', { method: 'POST', body: JSON.stringify({ entity_id: id }) });
        return;
      }
      const data = { entity_id: id };
      if (patch.bri != null) data.brightness_pct = Math.max(1, Math.min(100, Math.round(patch.bri)));
      if (patch.temp != null) data.color_temp_kelvin = Math.max(1500, Math.min(9000, Math.round(patch.temp)));
      else if (typeof patch.color === 'string' && /^#[0-9a-f]{6}$/i.test(patch.color)) {
        const n = parseInt(patch.color.slice(1), 16);
        data.rgb_color = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      await req('/api/services/light/turn_on', { method: 'POST', body: JSON.stringify(data) });
    },
  };
}

module.exports = { create };
