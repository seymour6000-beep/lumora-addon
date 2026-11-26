
/* ---- Lumora 4.8: Light watch (offline detection options and a health report) ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const KEY='hub-watch';
  const DEF={delay:60,reminderH:0,backOnline:true,flap:true,flapN:3,group:true,groupMin:2,quiet:{on:false,from:'23:00',to:'07:00'},muted:[]};
  const load=()=>{ let v={}; try{ v=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){} return Object.assign({},DEF,v,{quiet:Object.assign({},DEF.quiet,v.quiet||{}),muted:Array.isArray(v.muted)?v.muted:[]}); };
  let W=load();
  const save=()=>{ try{ store.set(KEY,W); }catch(e){ try{ localStorage.setItem(KEY,JSON.stringify(W)); }catch(x){} } };
  window.__watchMuted=id=>W.muted.includes(id);
  /* when did each light go offline (as seen by this page)? */
  const since={};
  window.__watchSeen=(d,now)=>{ if(now) delete since[d.id]; else if(!since[d.id]) since[d.id]=Date.now(); };
  const dur=ms=>{ const m=Math.max(1,Math.round(ms/60000)); return m<60?m+' min':(Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':'')); };
  window.__watchSince=id=>since[id]?'Offline for '+dur(Date.now()-since[id])+'. ':'';
  /* history events: from the server (add-on) or kept on this device (demo) */
  let H={events:[],names:{},now:Date.now()};
  async function pull(n){
    try{
      if(REMOTE){ const r=await srvApi('GET','/api/history?days='+n); if(r.ok&&r.json) H=r.json; }
      else { const h=JSON.parse(localStorage.getItem('hub-history')||'null'); if(h&&h.events) H={events:h.events,names:h.names||{},now:Date.now()}; }
    }catch(e){}
    return H;
  }
  const flapping=(id,ev,now)=>ev.filter(e=>e.id===id&&e.type==='offline'&&now-e.t<=3600000).length;
  window.__watchNotes=()=>{
    const out=[], now=Date.now(); if(typeof state==='undefined') return out;
    try{ const wl=document.getElementById('wLights'); if(wl&&wl.querySelectorAll('.sw').length!==state.length) drawLights(); }catch(e){}
    const ev=H.events||[];
    const mine=state.filter(d=>!W.muted.includes(d.id));
    if(W.flap) mine.forEach(d=>{ const n=flapping(d.id,ev,now); if(n>=W.flapN) out.push({k:'flap:'+d.id,lv:'warn',t:d.name+' keeps dropping out',d:'It went offline '+n+' times in the last hour. That usually means weak Wi-Fi, a loose bulb, or a switch that cuts its power.'}); });
    const down=mine.filter(d=>d.online===false);
    if(W.group&&mine.length>=3&&down.length>=Math.max(2,W.groupMin)&&down.length<mine.length&&down.length*2>=mine.length)
      out.push({k:'grp',lv:'warn',t:down.length+' of '+mine.length+' lights dropped together',d:'When several lights go offline at once, the cause is usually your router or a Wi-Fi extender, not the bulbs. Check those first.'});
    return out;
  };
  const stats=(id,ev,days,now)=>{
    const start=now-days*864e5; const mine=ev.filter(e=>e.id===id&&(e.type==='offline'||e.type==='online')).sort((a,b)=>a.t-b.t);
    let off=0,drops=0,longest=0,openAt=null,lastOff=null;
    mine.forEach(e=>{ if(e.type==='offline'){ if(openAt===null) openAt=Math.max(e.t,start); if(e.t>=start){ drops++; lastOff=e.t; } } else if(openAt!==null){ const d=Math.max(0,e.t-openAt); off+=d; longest=Math.max(longest,d); openAt=null; } });
    if(openAt!==null){ const d=Math.max(0,now-openAt); off+=d; longest=Math.max(longest,d); }
    const first=ev.length?Math.max(start,Math.min(...ev.map(e=>e.t))):start; const span=Math.max(now-first,60000);
    return {drops,off,longest,lastOff,up:ev.length?Math.max(0,Math.min(100,100*(1-off/span))):100,openAt};
  };
  /* settings panel */
  function build(){
    const host=document.getElementById('probePanel')||document.getElementById('notifyPanel'); if(!host||document.getElementById('watchPanel')) return;
    const p=document.createElement('div'); p.className='panel wide'; p.id='watchPanel';
    const opts=(arr,cur)=>arr.map(([v,l])=>'<option value="'+v+'"'+(String(v)===String(cur)?' selected':'')+'>'+l+'</option>').join('');
    p.innerHTML='<h3>Light watch</h3><p class="sub">Choose how Lumora spots a light that has gone offline and how it tells you. Phone alerts use the Phone alerts settings above and keep working when this page is closed. The notification list and health report work in the app.</p>'+
     '<div class="srow"><label for="wDelay">Send a phone alert after</label><select id="wDelay">'+opts([[0,'Right away'],[60,'1 minute'],[120,'2 minutes'],[300,'5 minutes'],[600,'10 minutes'],[1800,'30 minutes']],W.delay)+'</select></div>'+
     '<div class="srow"><label for="wRem">Remind me while it stays offline</label><select id="wRem">'+opts([[0,'Never'],[1,'Every hour'],[3,'Every 3 hours'],[6,'Every 6 hours'],[24,'Every day']],W.reminderH)+'</select></div>'+
     '<div class="srow"><span>Tell me when it comes back</span><button class="sw" role="switch" id="wBack" aria-label="Tell me when a light comes back"><i></i></button></div>'+
     '<div class="srow"><span>Warn when a light keeps dropping out</span><button class="sw" role="switch" id="wFlap" aria-label="Warn when a light keeps dropping out"><i></i></button></div>'+
     '<div class="srow"><label for="wFlapN">Drop-outs in one hour before warning</label><select id="wFlapN">'+opts([[2,'2 times'],[3,'3 times'],[5,'5 times'],[8,'8 times']],W.flapN)+'</select></div>'+
     '<div class="srow"><span>Warn when several lights drop together</span><button class="sw" role="switch" id="wGrp" aria-label="Warn when several lights drop together"><i></i></button></div>'+
     '<div class="srow"><span>Quiet hours for phone alerts</span><button class="sw" role="switch" id="wQ" aria-label="Quiet hours for phone alerts"><i></i></button></div>'+
     '<div class="srow" id="wQRow"><label for="wQf">From</label><input class="in" id="wQf" type="time" value="'+W.quiet.from+'"><label for="wQt">to</label><input class="in" id="wQt" type="time" value="'+W.quiet.to+'"></div>'+
     '<h4 class="hh">Lights to watch</h4><div id="wLights"></div>'+
     '<h4 class="hh">Health report</h4><div class="srow"><label for="wRange">Look back</label><select id="wRange">'+opts([[7,'7 days'],[30,'30 days']],7)+'</select></div><div id="wReport" aria-live="polite"></div>';
    if(typeof ROLE!=='undefined'&&ROLE!=='admin') p.classList.add('rolehide');
    host.parentNode.insertBefore(p,host);
    const sw=(id,get,set)=>{ const b=p.querySelector('#'+id); const paint=()=>{ b.classList.toggle('on',!!get()); b.setAttribute('aria-checked',String(!!get())); }; paint(); b.onclick=()=>{ set(!get()); save(); paint(); refreshNotes(); }; return paint; };
    sw('wBack',()=>W.backOnline,v=>W.backOnline=v); sw('wFlap',()=>W.flap,v=>W.flap=v); sw('wGrp',()=>W.group,v=>W.group=v);
    const qrow=p.querySelector('#wQRow'); const qp=sw('wQ',()=>W.quiet.on,v=>{ W.quiet.on=v; qrow.hidden=!v; }); qrow.hidden=!W.quiet.on;
    const sel=(id,key,num)=>{ p.querySelector('#'+id).onchange=e=>{ W[key]=num?Number(e.target.value):e.target.value; save(); refreshNotes(); }; };
    sel('wDelay','delay',1); sel('wRem','reminderH',1); sel('wFlapN','flapN',1);
    p.querySelector('#wQf').onchange=e=>{ W.quiet.from=e.target.value||'23:00'; save(); }; p.querySelector('#wQt').onchange=e=>{ W.quiet.to=e.target.value||'07:00'; save(); };
    p.querySelector('#wRange').onchange=()=>report();
    drawLights(); report();
  }
  function drawLights(){
    const box=document.getElementById('wLights'); if(!box||typeof state==='undefined') return; box.replaceChildren();
    if(!state.length){ const s=document.createElement('p'); s.className='sub'; s.textContent='No lights yet.'; box.appendChild(s); return; }
    state.forEach(d=>{
      const row=document.createElement('div'); row.className='srow'; const l=document.createElement('span'); l.textContent=d.name;
      const b=document.createElement('button'); b.className='sw'; b.type='button'; b.setAttribute('role','switch'); b.innerHTML='<i></i>'; b.setAttribute('aria-label','Watch '+d.name);
      const paint=()=>{ const on=!W.muted.includes(d.id); b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on)); };
      paint(); b.onclick=()=>{ if(W.muted.includes(d.id)) W.muted=W.muted.filter(x=>x!==d.id); else W.muted.push(d.id); save(); paint(); refreshNotes(); report(); };
      row.append(l,b); box.appendChild(row);
    });
  }
  async function report(){
    const box=document.getElementById('wReport'); if(!box||typeof state==='undefined') return;
    const days=Number((document.getElementById('wRange')||{}).value)||7; await pull(days);
    const now=Date.now(), ev=H.events||[]; box.replaceChildren();
    if(!state.length) return;
    if(!ev.length){ const s=document.createElement('p'); s.className='note'; s.textContent='No drop-outs recorded yet. Lumora keeps count from now on, so every light shows as steady until one drops.'; box.appendChild(s); }
    const tbl=document.createElement('div'); tbl.className='wtab'; box.appendChild(tbl);
    state.forEach(d=>{
      const s=stats(d.id,ev,days,now), muted=W.muted.includes(d.id), offNow=d.online===false, fl=flapping(d.id,ev,now)>=W.flapN;
      const row=document.createElement('div'); row.className='wrow'+(muted?' muted':'');
      const status=muted?['Not watched','']:offNow?['Offline now','bad']:fl?['Dropping out','warn']:s.drops?['Steady lately','']:['Steady','ok'];
      const bar='<span class="wbar" aria-hidden="true"><i style="width:'+s.up.toFixed(1)+'%"></i></span>';
      row.innerHTML='<div class="wn"><b></b><span class="wst '+status[1]+'">'+status[0]+'</span></div>'+bar+'<div class="wm"><span>'+s.up.toFixed(s.up>=99.95?0:1)+'% online</span><span>'+s.drops+(s.drops===1?' drop':' drops')+'</span><span>'+(s.longest?'Longest '+dur(s.longest):'No outages')+'</span><span>'+(s.lastOff?'Last '+new Date(s.lastOff).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'')+'</span></div>';
      row.querySelector('b').textContent=d.name; tbl.appendChild(row);
    });
  }
  function refreshNotes(){ try{ window.__renderNotes&&window.__renderNotes(); }catch(e){} }
  window.__watchReport=report; window.__watchPull=pull;
  const iv=()=>{ if(document.hidden) return; pull(1).then(refreshNotes); };
  const boot=()=>{ build(); pull(1).then(refreshNotes); setInterval(iv,60000); setInterval(()=>{ if(document.getElementById('wLights')&&!document.hidden){ drawLights(); } },15000); };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',()=>setTimeout(boot,500)); else setTimeout(boot,500);
  new MutationObserver(()=>{ if(document.body.dataset.auth==='in'){ build(); } }).observe(document.body,{attributes:true,attributeFilter:['data-auth']});
  /* refresh the report when the Settings tab is opened */
  document.addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('.tab')) setTimeout(()=>{ if(document.getElementById('wReport')) report(); },400); });
})();
