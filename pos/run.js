'use strict';
/* Add-on launcher: keeps POS data in the add-on's own /data folder, separate from Lumora. */
const { spawn } = require('child_process');
const env = { ...process.env, DATA_DIR: '/data', PORT: '8090', HOST: '0.0.0.0', TZ_NAME: process.env.TZ_NAME || 'America/Halifax' };
const c = spawn(process.execPath, ['server.js'], { env, stdio: 'inherit' });
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => c.kill(s)));
c.on('exit', (code) => process.exit(code == null ? 1 : code));
