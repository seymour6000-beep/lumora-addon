'use strict';
/* Finding a Lumora server on the home network. Pure Node, no Electron, so it can be tested on its own. */
const os = require('os');

function normalize(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return null;
    return u.origin;
  } catch (e) { return null; }
}

async function probe(origin, timeoutMs = 900, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(origin + '/api/boot', { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const j = await res.json();
    if (j && j.server === true && typeof j.version === 'string') return { origin, version: j.version };
  } catch (e) { /* not a Lumora server */ }
  return null;
}

function localSubnets(interfaces = os.networkInterfaces()) {
  const out = new Set();
  for (const list of Object.values(interfaces)) for (const i of list || []) {
    if (i.family !== 'IPv4' || i.internal) continue;
    const m = /^(\d+)\.(\d+)\.(\d+)\.\d+$/.exec(i.address);
    if (!m) continue;
    if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address)) continue;
    out.add(m[1] + '.' + m[2] + '.' + m[3]);
  }
  return [...out];
}

const NAMES = ['homeassistant.local', 'homeassistant', 'lumora.local'];

function candidates(ports = [8080], interfaces) {
  const out = [];
  for (const n of NAMES) for (const p of ports) out.push('http://' + n + ':' + p);
  for (const sub of localSubnets(interfaces)) for (let h = 1; h <= 254; h++) for (const p of ports) out.push('http://' + sub + '.' + h + ':' + p);
  return out;
}

/* Probe names first (fast), then sweep the network. onProgress(done, total). Returns the first server found, or null. */
async function find({ ports = [8080], timeoutMs = 700, concurrency = 48, onProgress, interfaces, fetchImpl, signal } = {}) {
  const list = candidates(ports, interfaces); const total = list.length; let next = 0, done = 0, found = null;
  const worker = async () => {
    while (!found && !(signal && signal.aborted)) {
      const i = next++; if (i >= total) return;
      const r = await probe(list[i], timeoutMs, fetchImpl);
      done++; if (onProgress) { try { onProgress(done, total); } catch (e) { /* ignore */ } }
      if (r && !found) found = r;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return found;
}

module.exports = { normalize, probe, localSubnets, candidates, find };
