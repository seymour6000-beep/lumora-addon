'use strict';
/* Talks to Home Assistant's REST API (https://developers.home-assistant.io/docs/api/rest/).
   Any light Home Assistant can see (Lepro, Hue, LIFX, Govee, ...) shows up in Lumora through this. */

const LIGHT_ID = /^light\.[a-z0-9_]{1,100}$/;

function create({ url, token, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
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
      name: String(a.friendly_name || s.entity_id).replace(/[<>&"']/g, '').slice(0, 30),
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
    return states.filter((s) => s && LIGHT_ID.test(String(s.entity_id))).map(mapLight);
  }

  return {
    name: 'homeassistant',
    isLightId: (id) => LIGHT_ID.test(String(id)),
    async ping() { await req('/api/'); return true; },
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
