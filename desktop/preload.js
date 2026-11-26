'use strict';
const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('lumoraDesktop', {
  isDesktop: true,
  getConfig: () => ipcRenderer.invoke('cfg:get'),
  setConfig: (k, v) => ipcRenderer.invoke('cfg:set', k, v),
  find: () => ipcRenderer.invoke('server:find'),
  cancelFind: () => ipcRenderer.send('server:cancel'),
  connect: (addr) => ipcRenderer.invoke('server:connect', addr),
  changeServer: () => ipcRenderer.send('server:change'),
  retry: () => ipcRenderer.send('server:retry'),
  onProgress: (fn) => ipcRenderer.on('server:progress', (_e, done, total) => fn(done, total)),
});

/* Inside the Lumora page: watch the notification list and hand new problems to Windows. */
if (!/^file:/.test(location.protocol) && !/[?&]popout=1/.test(location.search)) {
  const seen = new Set(); let first = true;
  const poll = async () => {
    try {
      const raw = await webFrame.executeJavaScript('JSON.stringify((window.__noteItems?window.__noteItems():[]).map(function(i){return {k:i.k,lv:i.lv,t:i.t,d:i.d};}))');
      const items = JSON.parse(raw || '[]');
      for (const i of items) {
        if (seen.has(i.k)) continue; seen.add(i.k);
        if (!first && (i.lv === 'warn' || i.lv === 'bad')) ipcRenderer.send('alert', { title: String(i.t || 'Lumora').slice(0, 80), body: String(i.d || '').slice(0, 200) });
      }
      const keys = new Set(items.map((i) => i.k)); for (const k of [...seen]) if (!keys.has(k)) seen.delete(k);
      if (window.__lumoraAuth !== false) first = false;
    } catch (e) { /* page not ready */ }
  };
  setInterval(poll, 5000); setTimeout(poll, 3000);
}
