/* Kindlewick service worker: keeps the app shell available offline. Never caches /api. */
const CACHE='lumora-shell-v6', SHELL=['/','/manifest.webmanifest','/icons/icon-192.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')) return;
  /* app shell: show the saved copy instantly, refresh it in the background */
  const shell=e.request.mode==='navigate'||u.pathname==='/'||u.pathname==='/index.html';
  const net=fetch(e.request).then(r=>{ if(r.ok){ const c=r.clone(); caches.open(CACHE).then(x=>x.put(shell?'/':e.request,c)); } return r; });
  if(shell) e.respondWith(caches.match('/').then(m=>m?(net.catch(()=>{}),m):net.catch(()=>new Response('Kindlewick is offline and has no saved copy yet.',{status:503}))));
  else e.respondWith(net.catch(()=>caches.match(e.request).then(m=>m||caches.match('/'))));
});
