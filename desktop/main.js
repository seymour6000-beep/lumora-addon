'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, shell, nativeImage, globalShortcut, dialog } = require('electron');
const path = require('path');
const configLib = require('./config');
const disc = require('./discover');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let cfg, win = null, tray = null, quitting = false, findAbort = null, popout = null;
let autoUpdater = null;

const icon = () => nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
const trayIcon = () => nativeImage.createFromPath(path.join(__dirname, 'build', 'tray.png')).resize({ width: 16, height: 16 });
const serverOrigin = () => disc.normalize(cfg.get('server'));
const webPrefs = () => ({ preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false });

function saveBounds() {
  if (!win || win.isDestroyed()) return;
  cfg.set('maximized', win.isMaximized());
  if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) cfg.set('bounds', win.getBounds());
}

function inScreen(b) {
  try {
    const { screen } = require('electron');
    return screen.getAllDisplays().some((d) => b.x < d.bounds.x + d.bounds.width - 60 && b.x + b.width > d.bounds.x + 60 && b.y < d.bounds.y + d.bounds.height - 60 && b.y + b.height > d.bounds.y);
  } catch (e) { return true; }
}

function showConnect(err) { if (win) win.loadFile(path.join(__dirname, 'ui', 'connect.html'), { query: err ? { err: String(err).slice(0, 200) } : {} }); }
function showOffline() { if (win) win.loadFile(path.join(__dirname, 'ui', 'offline.html'), { query: { server: serverOrigin() || '' } }); }

function openLumora() {
  const o = serverOrigin();
  if (!o) return showConnect();
  win.loadURL(o + '/').catch(() => { /* did-fail-load handles it */ });
}

function createWindow() {
  const b = cfg.get('bounds');
  win = new BrowserWindow({
    width: b && b.width >= 480 ? b.width : 1280, height: b && b.height >= 400 ? b.height : 820,
    ...(b && inScreen(b) ? { x: b.x, y: b.y } : {}),
    minWidth: 420, minHeight: 520, title: 'Lumora', icon: icon(), backgroundColor: '#0d0b1f', autoHideMenuBar: true, show: false,
    alwaysOnTop: !!cfg.get('alwaysOnTop'), webPreferences: webPrefs(),
  });
  if (cfg.get('maximized')) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('resize', saveBounds); win.on('move', saveBounds); win.on('maximize', saveBounds); win.on('unmaximize', saveBounds);
  win.on('close', (e) => {
    saveBounds();
    if (!quitting && cfg.get('closeToTray')) {
      e.preventDefault(); win.hide();
      if (!cfg.get('toldTray') && Notification.isSupported()) { cfg.set('toldTray', true); new Notification({ title: 'Lumora is still running', body: 'It stays in the tray so you get alerts. Right-click the tray icon to quit.' }).show(); }
    }
  });
  win.on('closed', () => { win = null; });
  win.webContents.on('did-finish-load', () => { const z = cfg.get('zoom'); if (z) win.webContents.setZoomLevel(z); });
  win.webContents.on('zoom-changed', () => {});
  win.webContents.on('did-fail-load', (_e, code, _d, url, isMain) => { if (isMain && code !== -3 && /^https?:/.test(url)) showOffline(); });
  win.webContents.on('page-title-updated', (e) => { e.preventDefault(); win.setTitle('Lumora'); });
  const sameOrigin = (u) => { try { return new URL(u).origin === serverOrigin(); } catch (e) { return false; } };
  win.webContents.on('will-navigate', (e, u) => { if (/^file:/.test(u) && /\/ui\//.test(u)) return; if (!sameOrigin(u)) { e.preventDefault(); if (/^https?:/.test(u)) shell.openExternal(u); } });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (sameOrigin(url) && /[?&]popout=1/.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 420, height: 720, minWidth: 300, minHeight: 360, alwaysOnTop: true, autoHideMenuBar: true, title: 'Lumora pop-out', icon: icon(), backgroundColor: '#0d0b1f', webPreferences: webPrefs() } };
    }
    if (/^https?:/.test(url) && !sameOrigin(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', (w) => { popout = w; w.on('closed', () => { if (popout === w) popout = null; }); });
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return;
    if ((input.control || input.meta) && (input.key === '=' || input.key === '+')) { zoomBy(0.5); }
    else if ((input.control || input.meta) && input.key === '-') { zoomBy(-0.5); }
    else if ((input.control || input.meta) && input.key === '0') { zoomTo(0); }
  });
  openLumora();
}
function zoomTo(z) { if (!win) return; z = Math.max(-3, Math.min(4, z)); win.webContents.setZoomLevel(z); cfg.set('zoom', z); }
function zoomBy(d) { if (win) zoomTo(win.webContents.getZoomLevel() + d); }

function showWindow() { if (!win) createWindow(); else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } }
function toggleWindow() { if (win && win.isVisible() && win.isFocused()) win.hide(); else showWindow(); }

function openPopout() {
  const o = serverOrigin(); if (!o) return;
  if (popout && !popout.isDestroyed()) { popout.show(); popout.focus(); return; }
  popout = new BrowserWindow({ width: 420, height: 720, minWidth: 300, minHeight: 360, alwaysOnTop: true, autoHideMenuBar: true, title: 'Lumora pop-out', icon: icon(), backgroundColor: '#0d0b1f', webPreferences: webPrefs() });
  popout.loadURL(o + '/?popout=1'); popout.on('closed', () => { popout = null; });
}

function checkUpdates(manual) {
  if (!app.isPackaged) { if (manual) dialog.showMessageBox({ message: 'Updates only work in the installed app.' }); return; }
  try {
    if (!autoUpdater) {
      ({ autoUpdater } = require('electron-updater'));
      autoUpdater.autoDownload = true;
      autoUpdater.on('update-downloaded', (info) => {
        if (Notification.isSupported()) { const n = new Notification({ title: 'Lumora update ready', body: 'Version ' + info.version + ' installs when you quit Lumora. Click to restart now.' }); n.on('click', () => { quitting = true; autoUpdater.quitAndInstall(); }); n.show(); }
      });
      autoUpdater.on('update-not-available', () => { if (manual) dialog.showMessageBox({ message: 'You have the latest version of Lumora.' }); });
      autoUpdater.on('error', (e) => { if (manual) dialog.showMessageBox({ type: 'error', message: 'Could not check for updates.', detail: String(e && e.message || e).slice(0, 200) }); });
    }
    autoUpdater.checkForUpdates();
  } catch (e) { if (manual) dialog.showMessageBox({ type: 'error', message: 'Could not check for updates.' }); }
}

function buildTray() {
  tray = new Tray(trayIcon()); tray.setToolTip('Lumora');
  const refresh = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Lumora', click: showWindow },
    { label: 'Open the pop-out window', click: openPopout, enabled: !!serverOrigin() },
    { type: 'separator' },
    { label: 'Keep on top', type: 'checkbox', checked: !!cfg.get('alwaysOnTop'), click: (m) => { cfg.set('alwaysOnTop', m.checked); if (win) win.setAlwaysOnTop(m.checked); } },
    { label: 'Desktop alerts', type: 'checkbox', checked: !!cfg.get('alerts'), click: (m) => cfg.set('alerts', m.checked) },
    { label: 'Close button hides to the tray', type: 'checkbox', checked: !!cfg.get('closeToTray'), click: (m) => cfg.set('closeToTray', m.checked) },
    { label: 'Start with Windows', type: 'checkbox', checked: !!cfg.get('openAtLogin'), click: (m) => { cfg.set('openAtLogin', m.checked); app.setLoginItemSettings({ openAtLogin: m.checked }); } },
    { type: 'separator' },
    { label: 'Change server…', click: () => { showWindow(); showConnect(); } },
    { label: 'Check for updates', click: () => checkUpdates(true) },
    { label: 'Version ' + app.getVersion(), enabled: false },
    { type: 'separator' },
    { label: 'Quit Lumora', click: () => { quitting = true; app.quit(); } },
  ]));
  refresh(); tray.on('click', toggleWindow); tray.on('right-click', refresh);
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Lumora', submenu: [
      { label: 'Pop-out window', accelerator: 'CmdOrCtrl+Shift+P', click: openPopout },
      { label: 'Change server…', click: () => showConnect() },
      { label: 'Check for updates', click: () => checkUpdates(true) },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } },
    ] },
    { label: 'View', submenu: [
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => { if (win) { if (/^file:/.test(win.webContents.getURL())) openLumora(); else win.webContents.reload(); } } },
      { role: 'togglefullscreen' },
      { label: 'Zoom in', accelerator: 'CmdOrCtrl+=', click: () => zoomBy(0.5) },
      { label: 'Zoom out', accelerator: 'CmdOrCtrl+-', click: () => zoomBy(-0.5) },
      { label: 'Actual size', accelerator: 'CmdOrCtrl+0', click: () => zoomTo(0) },
    ] },
  ]));
}

/* ---- messages from the connect and offline pages ---- */
ipcMain.on('win:exitfs', (e) => { try { const w = BrowserWindow.fromWebContents(e.sender); if (w && !w.isDestroyed() && w.isFullScreen()) w.setFullScreen(false); } catch (err) { /* ignore */ } });
ipcMain.handle('cfg:get', () => ({ ...cfg.all(), version: app.getVersion() }));
ipcMain.handle('cfg:set', (_e, k, v) => { if (['closeToTray', 'alerts', 'alwaysOnTop', 'openAtLogin'].includes(k)) { cfg.set(k, !!v); if (k === 'openAtLogin') app.setLoginItemSettings({ openAtLogin: !!v }); if (k === 'alwaysOnTop' && win) win.setAlwaysOnTop(!!v); } return true; });
ipcMain.handle('server:find', async (e) => {
  if (findAbort) findAbort.abort(); findAbort = new AbortController();
  const r = await disc.find({ ports: [8080], signal: findAbort.signal, onProgress: (d, t) => { try { e.sender.send('server:progress', d, t); } catch (x) { /* window closed */ } } });
  findAbort = null; return r;
});
ipcMain.on('server:cancel', () => { if (findAbort) findAbort.abort(); });
ipcMain.handle('server:connect', async (_e, addr) => {
  const o = disc.normalize(addr); if (!o) return { ok: false, error: 'That does not look like an address. Try something like 192.168.1.50:8080.' };
  const r = await disc.probe(o, 3000);
  if (!r) return { ok: false, error: 'Lumora did not answer at ' + o + '. Check the address and that Lumora is running.' };
  cfg.set('server', o); cfg.flush(); setImmediate(openLumora); return { ok: true, origin: o, version: r.version };
});
ipcMain.on('server:change', () => showConnect());
ipcMain.on('server:retry', () => openLumora());
ipcMain.on('alert', (_e, a) => {
  if (!cfg.get('alerts') || !Notification.isSupported() || !a) return;
  if (win && win.isVisible() && win.isFocused()) return;
  const n = new Notification({ title: a.title, body: a.body, icon: icon() }); n.on('click', showWindow); n.show();
});

if (gotLock) {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(() => {
    cfg = configLib.create(app.getPath('userData'));
    app.setAppUserModelId('ca.lumora.desktop');
    buildMenu(); buildTray(); createWindow();
    globalShortcut.register('CommandOrControl+Alt+L', toggleWindow);
    setTimeout(() => checkUpdates(false), 15000);
  });
  app.on('before-quit', () => { quitting = true; if (cfg) cfg.flush(); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => { if (quitting) app.quit(); });
  app.on('activate', showWindow);
}
