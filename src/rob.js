
/* ---- Lumora 3: effects and a sturdier shell ---- */
const fxPerf={v:isTV()?'subtle':'full'};
function fxResolve(){
  if(settings.reduceMotion||(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)) return 'off';
  const m=settings.fxMode||'auto'; return m==='auto'?fxPerf.v:m;
}
function applyFx(){ const v=fxResolve(), r=document.documentElement; if(r.dataset.fx!==v) r.dataset.fx=v; const e=$('sFxNote'); if(e) e.textContent=(settings.fxMode||'auto')==='auto'?'Automatic is currently '+v+'.':''; }
applyFx();
if(typeof apply==='function'){ const _ap=apply; apply=function(){ const r=_ap.apply(this,arguments); applyFx(); return r; }; }
document.addEventListener('change',()=>setTimeout(applyFx,60));
/* a short speed test: slow screens (some TVs) quietly drop to Subtle */
(function(){ let n=0,t0=0; function f(t){ if(!t0) t0=t; n++; if(t-t0<1600) requestAnimationFrame(f); else if(n/((t-t0)/1000)<28){ fxPerf.v='subtle'; applyFx(); } } if(!document.hidden) requestAnimationFrame(f); })();

/* blooms and bursts */
(function(){
  const fxOn=()=>document.documentElement.dataset.fx==='full';
  function spawn(cls,x,y,c){ const el=document.createElement('div'); el.className=cls; el.style.setProperty('--x',x+'px'); el.style.setProperty('--y',y+'px'); el.style.setProperty('--c',c); document.body.appendChild(el); setTimeout(()=>el.remove(),1200); }
  const colorOf=b=>{ const lt=b.closest('.lt'), d=state.find(x=>lt&&x.id===lt.dataset.id); return (d&&d.color)||'#ffd9a8'; };
  document.addEventListener('pointerdown',e=>{ if(!fxOn()) return; const b=e.target.closest&&e.target.closest('.lt .bulb'); if(b) spawn('bloom',e.clientX,e.clientY,colorOf(b)); },true);
  document.addEventListener('click',e=>{
    if(!fxOn()) return;
    const b=e.target.closest&&e.target.closest('.lt .bulb'); if(b&&e.detail===0){ const r=b.getBoundingClientRect(); spawn('bloom',r.left+r.width/2,r.top+r.height/2,colorOf(b)); }
    const s=e.target.closest&&e.target.closest('#scenes .btn'); if(s){ const r=s.getBoundingClientRect(); spawn('burst',r.left+r.width/2,r.top+r.height/2,getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#ffc233'); }
  },true);
})();

/* tab changes cross-fade, and each page's cards rise in one after another */
(function(){
  const orig=window.showTab; let ux=0;
  const mark=e=>{ if(e.target.closest&&e.target.closest('.tab,#tabs,.dock')) ux=Date.now(); };
  document.addEventListener('pointerdown',mark,true);
  document.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' ') mark(e); },true);
  function enter(n){
    const sec=document.querySelector('section[data-tab="'+n+'"]'); if(!sec||document.documentElement.dataset.fx!=='full') return;
    let i=0; sec.querySelectorAll('.lt,.panel,.cam,.stat,.nitem').forEach(el=>el.style.setProperty('--i',Math.min(i++,16)));
    sec.classList.add('enter'); setTimeout(()=>sec.classList.remove('enter'),1500);
  }
  window.showTab=function(n){
    if(document.startViewTransition&&document.documentElement.dataset.fx==='full'&&Date.now()-ux<600){
      try{ document.startViewTransition(()=>{ orig(n); enter(n); }); return; }catch(e){}
    }
    orig(n); enter(n);
  };
})();

/* ---- a sturdier shell: errors, reconnecting, recovery, backup ---- */
const HEALTH={server:true,ha:null};
(function(){
  const errs=window.__errs||(window.__errs=[]);
  let seenErr=errs.length, lastToast=0;
  const when=t=>new Date(t).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'});
  function renderHealth(){
    const box=$('healthRows'); if(!box) return;
    const rows=[
      ['Version','v'+APP_VERSION,''],
      ['Lumora server',SRV?(HEALTH.server?'Reachable':'Not reachable'):'Not used in this preview',HEALTH.server?'good':'badc'],
      ['Home Assistant',SRV&&SRV.config&&SRV.config.adapter==='homeassistant'?(HEALTH.ha===true||window.__live?'Connected, live':(HEALTH.ha===false?'Not reachable':'Connected, checking every 5 s')):'Not set up',HEALTH.ha===false?'badc':''],
      ['Effects',(settings.fxMode||'auto')+' ('+(document.documentElement.dataset.fx||'?')+')',''],
      ['Problems since opening',String(errs.length),errs.length?'badc':'good']
    ];
    box.replaceChildren(...rows.map(r=>{ const d=document.createElement('div'); d.className='hrow'; const a=document.createElement('span'); a.textContent=r[0]; const b=document.createElement('span'); b.textContent=r[1]; if(r[2]) b.className=r[2]; d.append(a,b); return d; }));
    const ul=$('errList'); ul.replaceChildren(...errs.slice(-8).reverse().map(e=>{ const li=document.createElement('li'); li.textContent=when(e.t)+'  '+e.m+(e.s?'  ('+e.s+')':''); return li; }));
    ul.hidden=!errs.length;
  }
  window.__renderHealth=renderHealth;
  setInterval(()=>{
    if(errs.length>seenErr){ seenErr=errs.length; const now=Date.now(); if(now-lastToast>60000){ lastToast=now; try{ toast('Something went wrong. Lumora kept going. Details are in Settings, Health.'); }catch(e){} } }
    if(document.body.dataset.tabnow==='Settings') renderHealth();
  },1500);
  $('hCopy').onclick=async()=>{
    const txt='Lumora '+APP_VERSION+'\n'+navigator.userAgent+'\n'+new Date().toISOString()+'\n\n'+(errs.length?errs.map(e=>when(e.t)+' '+e.m+' '+(e.s||'')).join('\n'):'No problems recorded.');
    try{ await navigator.clipboard.writeText(txt); $('hMsg').textContent='Copied. Paste it into a message.'; }catch(e){ $('hMsg').textContent='Couldn’t copy here. Select the problem list and copy it.'; }
  };
  $('hClear').onclick=()=>{ errs.length=0; seenErr=0; renderHealth(); $('hMsg').textContent='Cleared.'; };

  /* backup and restore */
  const KEYS=['hub-lights','hub-rules','hub-cams','hub-settings','hub-scenes','hub-removed','hub-apps','hub-power','hub-activity','hub-presence','hub-money','hub-notify'];
  $('hBackup').onclick=()=>{
    const keys={}; KEYS.forEach(k=>{ try{ const v=localStorage.getItem(k); if(typeof v==='string') keys[k]=v; }catch(e){} });
    const blob=new Blob([JSON.stringify({app:'lumora',version:APP_VERSION,created:new Date().toISOString(),keys},null,1)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='lumora-backup-'+new Date().toISOString().slice(0,10)+'.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    $('hMsg').textContent='Backup saved. It includes your lights, automations, scenes, settings, money and phone-alert details, but not account passwords.';
  };
  $('hRestore').onclick=()=>$('hFile').click();
  $('hFile').onchange=async e=>{
    const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return; const m=$('hMsg');
    if(f.size>3*1024*1024){ m.textContent='That file is too big to be a Lumora backup.'; return; }
    let j; try{ j=JSON.parse(await f.text()); }catch(x){ m.textContent='That file isn’t a Lumora backup.'; return; }
    if(!j||j.app!=='lumora'||!j.keys||typeof j.keys!=='object'){ m.textContent='That file isn’t a Lumora backup.'; return; }
    const ok=[]; for(const k of KEYS){ const v=j.keys[k]; if(typeof v!=='string'||v.length>512*1024) continue; try{ JSON.parse(v); }catch(x){ continue; } ok.push([k,v]); }
    if(!ok.length){ m.textContent='There was nothing usable in that backup.'; return; }
    if(!confirm('Restore '+ok.length+' saved items from this backup? Your current lights, automations and settings will be replaced.')) return;
    m.textContent='Restoring…';
    for(const [k,v] of ok){ try{ localStorage.setItem(k,v); }catch(x){} if(SRV) await srvApi('PUT','/api/data/'+k,{value:v}); }
    m.textContent='Restored. Reloading…'; setTimeout(()=>location.reload(),600);
  };

  /* reconnecting bar */
  if(SRV){
    let fails=0; const bar=$('netbar');
    const down=()=>{ HEALTH.server=false; bar.classList.add('on'); };
    const up=()=>{ HEALTH.server=true; bar.classList.remove('on'); };
    async function ping(){
      let ok=false;
      try{ const r=await fetch('/api/health',{cache:'no-store',credentials:'same-origin'}); if(r.ok){ ok=true; const h=await r.json(); HEALTH.ha=h.ha?!!h.ha.live||h.ha.reachable!==false:null; } }catch(e){}
      if(ok){ if(fails>=2){ up(); try{ toast('Reconnected'); }catch(e){} if(window.__pollLights) window.__pollLights(); } fails=0; HEALTH.server=true; }
      else{ fails++; if(fails>=2) down(); }
      setTimeout(ping,fails?3000:10000);
    }
    setTimeout(ping,4000);
    addEventListener('offline',()=>{ fails=Math.max(fails,2); down(); });
  }

  /* if the app never starts after signing in, offer a way out instead of a blank page */
  setTimeout(function chk(){
    if(typeof started!=='undefined'&&started) return;
    if(document.body.dataset.auth==='in'&&errs.length){
      $('rescueMsg').textContent=(errs[errs.length-1].m||'Unknown problem');
      $('rescue').classList.add('on'); $('rescueReload').focus(); return;
    }
    if(document.body.dataset.auth==='in') setTimeout(chk,4000);
  },12000);
  $('rescueReload').onclick=()=>location.reload();
  $('rescueReset').onclick=()=>{
    try{ Object.keys(localStorage).filter(k=>/^hub-/.test(k)&&!/user|session|auth|login|token/i.test(k)).forEach(k=>localStorage.removeItem(k)); }catch(e){}
    location.reload();
  };
  $('rescueHide').onclick=()=>$('rescue').classList.remove('on');
  renderHealth();
})();
