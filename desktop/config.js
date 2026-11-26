'use strict';
const fs = require('fs'), path = require('path');
const DEFAULTS = { server: '', bounds: null, maximized: false, closeToTray: true, alerts: true, openAtLogin: false, alwaysOnTop: false, zoom: 0, toldTray: false };
function create(dir) {
  const file = path.join(dir, 'lumora-desktop.json');
  let data = { ...DEFAULTS };
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j === 'object') data = { ...DEFAULTS, ...j }; } catch (e) { /* first run */ }
  let t = null;
  const flush = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(data)); fs.renameSync(file + '.tmp', file); } catch (e) { /* ignore */ } };
  return {
    get: (k) => data[k], all: () => ({ ...data }),
    set(k, v) { data[k] = v; clearTimeout(t); t = setTimeout(flush, 300); if (t.unref) t.unref(); },
    flush,
  };
}
module.exports = { create, DEFAULTS };
