
/* ---- Lumora 6.1: Settings, organised by topic ---- */
(function(){
  const el=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; };
  const GROUPS=[
    {id:'account',label:'Account and people',ic:'user',hint:'Your sign-in, household members and login security',p:['Account','Household','Security']},
    {id:'home',label:'Home and look',ic:'home',hint:'Name, clock, theme and background',p:['Home','Design','Background']},
    {id:'lights',label:'Lights and rooms',ic:'bulb',hint:'Lights, scenes, sleep mode and light checks',p:['Lights','Your scenes','Sleep mode','Light watch','Offline detection','Automations and location']},
    {id:'devices',label:'Devices and cameras',ic:'sensor',hint:'Sensors, locks, cameras and power cuts',p:['Devices','Cameras','Power outage']},
    {id:'alerts',label:'Alerts and sound',ic:'bell',hint:'Notifications, phone alerts and the red-light beep',p:['Notifications and sound','Status lights','Phone alerts']},
    {id:'connections',label:'Connections',ic:'link',hint:'Home Assistant, Spotify, Bluetooth, Google Home and Alexa',p:['Connections','Spotify','Bluetooth','Google Home and Alexa']},
    {id:'screens',label:'Screens and apps',ic:'apps',hint:'TV, remote and the Windows app',p:['Use Lumora on a TV','Approve a TV','TV and remote','Lumora for Windows']},
    {id:'system',label:'System and backup',ic:'gear',hint:'Health, backup, server address and version',p:['Health and backup','This server’s address','Data and about','About Lumora']}
  ];
  const norm=t=>String(t||'').replace(/[’‘]/g,"'").trim().toLowerCase();
  const gOf=title=>{ const n=norm(title); for(const g of GROUPS){ const i=g.p.findIndex(x=>norm(x)===n); if(i>-1) return {g:g.id,o:i}; } return {g:'system',o:99}; };
  const sec=()=>document.querySelector('section[data-tab="Settings"]');
  const grid=()=>document.querySelector('section[data-tab="Settings"] .sgrid');
  const rd=()=>{ try{ return localStorage.getItem('hub-setgroup')||''; }catch(e){ return ''; } };
  let active=rd()||'account', busy=false;
  function statusPanel(){
    const g=grid(); if(!g||document.getElementById('lampPanel')) return;
    const p=el('div','panel'); p.id='lampPanel';
    p.innerHTML='<h3>Status lights</h3><p class="sub">The lights on the left of the screen show green when things are good, yellow when something needs a look, and red when something is wrong.</p>'+
      '<div class="srow"><span>Beep for 5 seconds when a light turns red</span><button class="sw" role="switch" id="beepSw" aria-label="Beep for 5 seconds when a light turns red"><i></i></button></div>'+
      '<div class="nrow"><button class="btn sm" type="button" id="beepTest">Test the beep</button></div><p class="sub">Your browser only allows sound after you have tapped or clicked something on the page.</p>';
    g.appendChild(p);
    const sw=p.querySelector('#beepSw'); const paint=()=>{ const on=settings.beepRed!==false; sw.classList.toggle('on',on); sw.setAttribute('aria-checked',String(on)); }; paint();
    sw.onclick=()=>{ settings.beepRed=settings.beepRed===false; saveSettings(); paint(); };
    p.querySelector('#beepTest').onclick=()=>{ if(window.__beep) window.__beep(5000); };
  }
  function build(){
    const s=sec(), g=grid(); if(!s||!g) return false;
    if(!s.querySelector('.setnav')){
      const wrap=el('div','setwrap'); const nav=el('nav','setnav'); nav.setAttribute('aria-label','Settings sections');
      GROUPS.forEach(x=>{ const b=el('button','setb'); b.type='button'; b.dataset.g=x.id; b.innerHTML=ICO(x.ic)+'<span class="sbt"><b></b><em></em></span>'; b.querySelector('b').textContent=x.label; b.querySelector('em').textContent=x.hint; b.onclick=()=>choose(x.id); nav.appendChild(b); });
      g.parentNode.insertBefore(wrap,g); wrap.append(nav,g);
      const q=document.getElementById('setQ'); if(q) q.addEventListener('input',()=>{ s.dataset.search=q.value.trim()?'1':'0'; });
      const h=el('h3','sgtitle'); h.id='sgTitle'; g.parentNode.insertBefore(h,g);
    }
    return true;
  }
  function tidy(){
    if(busy) return; const g=grid(); if(!g||!build()) return; busy=true;
    try{
      statusPanel();
      const panels=[...g.children].filter(c=>c.classList&&c.classList.contains('panel'));
      panels.forEach(p=>{ const h=p.querySelector('h3,h2'); const m=gOf(h&&h.textContent); p.dataset.g=m.g; p.dataset.o=m.o; });
      const order=GROUPS.map(x=>x.id);
      const want=panels.slice().sort((a,b)=>order.indexOf(a.dataset.g)-order.indexOf(b.dataset.g)||a.dataset.o-b.dataset.o);
      if(want.some((p,i)=>p!==panels[i])) want.forEach(p=>g.appendChild(p));
      apply();
    } finally { busy=false; }
  }
  function apply(){
    const s=sec(), g=grid(); if(!s||!g) return; if(!GROUPS.some(x=>x.id===active)) active='account';
    g.querySelectorAll(':scope>.panel').forEach(p=>p.classList.toggle('sgoff',p.dataset.g!==active));
    s.querySelectorAll('.setb').forEach(b=>{ const on=b.dataset.g===active; b.classList.toggle('on',on); if(on) b.setAttribute('aria-current','true'); else b.removeAttribute('aria-current');
      const n=[...g.querySelectorAll(':scope>.panel')].filter(p=>p.dataset.g===b.dataset.g&&!p.hidden).length; b.dataset.n=n; });
    const t=document.getElementById('sgTitle'), G=GROUPS.find(x=>x.id===active); if(t&&G) t.textContent=G.label;
  }
  function choose(id){ active=id; try{ localStorage.setItem('hub-setgroup',id); }catch(e){} apply(); const nav=sec().querySelector('.setb.on'); if(nav&&nav.scrollIntoView) try{ nav.scrollIntoView({block:'nearest',inline:'center'}); }catch(e){} }
  const sync=()=>{ const v=rd(); if(v&&v!==active) active=v; tidy(); };
  if(typeof showTab==='function'){ const _s=showTab; showTab=function(t){ const r=_s.apply(this,arguments); if(t==='Settings'){ try{ sync(); }catch(e){} } return r; }; }
  window.__settingsGroups=()=>GROUPS.map(x=>({id:x.id,label:x.label}));
  const boot=()=>{ tidy(); const g=grid(); if(g) new MutationObserver(()=>{ if(!busy) setTimeout(tidy,60); }).observe(g,{childList:true,attributes:true,attributeFilter:['hidden'],subtree:false}); setInterval(tidy,3000); };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',()=>setTimeout(boot,1500)); else setTimeout(boot,1500);
})();
