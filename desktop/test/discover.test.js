'use strict';
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const disc = require('../discover'), configLib = require('../config');
(async () => {
  let n = 0; const t = (c, m) => { assert.ok(c, m); n++; };
  t(disc.normalize('192.168.1.50:8080') === 'http://192.168.1.50:8080', 'adds http');
  t(disc.normalize(' http://homeassistant.local:8080/ ') === 'http://homeassistant.local:8080', 'trims path');
  t(disc.normalize('') === null && disc.normalize('ftp://x') === null && disc.normalize('http://') === null, 'rejects junk');
  const subs = disc.localSubnets({ eth0: [{ family: 'IPv4', address: '192.168.4.20', internal: false }, { family: 'IPv4', address: '127.0.0.1', internal: true }, { family: 'IPv4', address: '8.8.8.8', internal: false }], v: [{ family: 'IPv6', address: 'fe80::1' }, { family: 'IPv4', address: '10.0.0.5' }] });
  t(subs.length === 2 && subs.includes('192.168.4') && subs.includes('10.0.0'), 'private subnets only: ' + subs);
  const c = disc.candidates([8080], { e: [{ family: 'IPv4', address: '192.168.4.20', internal: false }] });
  t(c.length === 3 + 254 && c[0] === 'http://homeassistant.local:8080' && c.includes('http://192.168.4.254:8080'), 'candidate list');
  const srv = http.createServer((q, r) => { if (q.url === '/api/boot') { r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ server: true, version: '4.10.0' })); } else { r.statusCode = 404; r.end(); } });
  const other = http.createServer((q, r) => { r.setHeader('content-type', 'application/json'); r.end('{"hello":1}'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); await new Promise((r) => other.listen(0, '127.0.0.1', r));
  const o1 = 'http://127.0.0.1:' + srv.address().port, o2 = 'http://127.0.0.1:' + other.address().port;
  const p = await disc.probe(o1); t(p && p.version === '4.10.0', 'probe finds Lumora');
  t((await disc.probe(o2)) === null, 'probe ignores other servers'); t((await disc.probe('http://127.0.0.1:1')) === null, 'probe handles closed port');
  /* find(): fake the network by pointing the fetch at a map of host -> real server */
  const fake = async (url, opts) => { const u = new URL(url); if (u.hostname === 'lumora.local') return fetch(o1 + u.pathname, opts); throw new Error('no route'); };
  let last = 0; const r = await disc.find({ ports: [8080], interfaces: {}, fetchImpl: fake, onProgress: (d) => { last = d; } });
  t(r && r.origin === 'http://lumora.local:8080', 'find picks the Lumora host: ' + JSON.stringify(r)); t(last >= 1, 'progress reported');
  const none = await disc.find({ ports: [8080], interfaces: {}, fetchImpl: async () => { throw new Error('x'); } }); t(none === null, 'find returns null when nothing answers');
  const ac = new AbortController(); ac.abort(); const ab = await disc.find({ interfaces: {}, fetchImpl: fake, signal: ac.signal }); t(ab === null, 'abort stops the search');
  /* config */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcfg-')); let cfg = configLib.create(dir);
  t(cfg.get('closeToTray') === true && cfg.get('server') === '', 'defaults'); cfg.set('server', 'http://a:8080'); cfg.set('bounds', { x: 1, y: 2, width: 800, height: 600 }); cfg.flush();
  cfg = configLib.create(dir); t(cfg.get('server') === 'http://a:8080' && cfg.get('bounds').width === 800, 'config persists');
  fs.writeFileSync(path.join(dir, 'lumora-desktop.json'), '{bad'); cfg = configLib.create(dir); t(cfg.get('alerts') === true, 'bad file falls back to defaults');
  srv.close(); other.close(); console.log(n + ' passed, 0 failed'); process.exit(0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
