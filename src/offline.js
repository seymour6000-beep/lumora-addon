
/* ---- Lumora 6, part 4: offline notice ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  let bar=null;
  const upd=()=>{
    if(navigator.onLine){ if(bar){ bar.remove(); bar=null; } return; }
    if(bar) return; bar=document.createElement('div'); bar.id='offBar'; bar.setAttribute('role','status');
    bar.textContent='You are offline. Lumora shows what it last knew and will reconnect on its own.'; document.body.appendChild(bar);
  };
  addEventListener('online',upd); addEventListener('offline',upd); setTimeout(upd,1200);
})();
