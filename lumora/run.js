'use strict';
/* Add-on launcher: reads the add-on options and uses the Supervisor to reach Home Assistant, so no token is needed. */
const fs = require('fs'), { spawn } = require('child_process');
let o = {}; try { o = JSON.parse(fs.readFileSync('/data/options.json', 'utf8')); } catch (e) { /* defaults */ }
const env = { ...process.env, DATA_DIR: '/data', PORT: '8080', HOST: '0.0.0.0', ALLOW_SIGNUP: o.allow_signup ? 'true' : 'false' };
if (process.env.SUPERVISOR_TOKEN) { env.HA_URL = 'http://supervisor/core'; env.HA_TOKEN = process.env.SUPERVISOR_TOKEN; }
const c = spawn(process.execPath, ['server.js'], { env, stdio: 'inherit' });
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => c.kill(s)));
c.on('exit', (code) => process.exit(code == null ? 1 : code));
