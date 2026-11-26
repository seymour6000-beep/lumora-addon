const $ = (id) => document.getElementById(id), api = window.lumoraDesktop;
const msg = (t, bad) => { $('msg').textContent = t || ''; $('msg').className = 'msg' + (bad ? ' bad' : ''); };
const q = new URLSearchParams(location.search); if (q.get('err')) msg(q.get('err'), true);
api.getConfig().then((c) => { if (c.server) $('addr').value = c.server.replace(/^https?:\/\//, ''); });
async function connect(addr) {
  $('go').disabled = true; $('find').disabled = true; msg('Connecting…');
  const r = await api.connect(addr);
  if (!r.ok) { msg(r.error, true); $('go').disabled = false; $('find').disabled = false; } else msg('Connected. Opening Lumora…');
}
$('form').addEventListener('submit', (e) => { e.preventDefault(); connect($('addr').value); });
let finding = false;
api.onProgress((d, t) => { $('barFill').style.width = Math.round((d / t) * 100) + '%'; });
$('find').addEventListener('click', async () => {
  if (finding) { api.cancelFind(); return; }
  finding = true; $('find').textContent = 'Stop looking'; $('bar').hidden = false; $('barFill').style.width = '0'; $('go').disabled = true; msg('Looking on your home network…');
  const r = await api.find(); finding = false; $('find').textContent = 'Find my server automatically'; $('bar').hidden = true; $('go').disabled = false;
  if (r) { $('addr').value = r.origin.replace(/^https?:\/\//, ''); msg('Found Lumora ' + r.version + ' at ' + r.origin + '.'); connect(r.origin); }
  else msg('No Lumora server found. Type its address instead. It is at the bottom of Settings in Lumora.', true);
});
$('addr').focus();
