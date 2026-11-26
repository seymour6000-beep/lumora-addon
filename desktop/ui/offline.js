const $ = (id) => document.getElementById(id), api = window.lumoraDesktop;
const s = new URLSearchParams(location.search).get('server'); if (s) $('where').textContent = 'Lumora isn’t answering at ' + s + '. Check that Home Assistant is running and that this computer is on your home network.';
$('retry').addEventListener('click', () => { $('msg').textContent = 'Trying…'; api.retry(); });
$('change').addEventListener('click', () => api.changeServer());
setInterval(() => api.retry(), 10000);
