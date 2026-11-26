
/* ---- Lumora 6, part 3: security (alarm modes, timeline, snapshots) ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const el=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; };
  const DK='hub-secdemo', CK='hub-security', SK='hub-snaps';
  const cfgLoad=()=>{ let v={}; try{ v=JSON.parse(localStorage.getItem(CK)||'{}')||{}; }catch(e){} return Object.assign({delay:20,flash:true},v); };
  let CFG=cfgLoad(); const cfgSave=()=>{ try{ store.set(CK,CFG); }catch(e){ try{ localStorage.setItem(CK,JSON.stringify(CFG)); }catch(x){} } };
  /* demo mode keeps its own alarm in this page; the add-on keeps the real one on the server */
  let D={mode:'off',alarm:{state:'idle'},events:[],armedAt:0}; try{ const v=JSON.parse(localStorage.getItem(DK)||'null'); if(v&&v.mode){ D=v; if(D.alarm&&D.alarm.state==='pending') D.alarm={state:'idle'}; } }catch(e){}
  const dSave=()=>{ try{ localStorage.setItem(DK,JSON.stringify(D)); }catch(e){} };
  let S={mode:'off',alarm:{state:'idle'},events:[],armedAt:0,cfg:CFG}; let dTimer=null, prevLights=null;
  const isRemote=()=>typeof REMOTE!=='undefined'&&REMOTE;
  const dEvent=(k,m)=>{ D.events.unshift({t:Date.now(),k,m}); if(D.events.length>100) D.events.length=100; dSave(); };
  async function dFlashOn(){ if(!CFG.flash) return; try{ prevLights=state.filter(d=>d.online!==false).map(d=>({id:d.id,on:d.on,bri:d.bri,color:d.color})); for(const l of prevLights){ if(D.alarm.state!=='sounding') break; await adapter.set(l.id,{on:true,bri:100,color:'#ff1f1f'}); } state=await adapter.list(); render(); if(D.alarm.state!=='sounding') dFlashOff(); }catch(e){} }
  async function dFlashOff(){ const p=prevLights; prevLights=null; if(!p) return; try{ for(const l of p) await adapter.set(l.id,l.on?{on:true,bri:l.bri,color:l.color}:{on:false}); state=await adapter.list(); render(); }catch(e){} }
  function dSound(reason){ if(D.alarm.state==='sounding') return; D.alarm={state:'sounding',since:Date.now(),reason}; dEvent('alarm','ALARM: '+reason); dSave(); dFlashOn(); try{ toast('Alarm: '+reason); }catch(e){} }
  function dTrigger(reason,entry){
    if(D.mode==='off'||D.alarm.state!=='idle') return; if(D.armedAt&&Date.now()-D.armedAt<CFG.delay*1000) return;
    if(entry&&CFG.delay>0){ D.alarm={state:'pending',since:Date.now(),until:Date.now()+CFG.delay*1000,reason}; dEvent('pending',reason+'. Alarm in '+CFG.delay+' seconds unless you disarm'); dSave(); clearTimeout(dTimer); dTimer=setTimeout(()=>{ if(D.alarm.state==='pending'){ D.alarm={state:'idle'}; dSound(reason); draw(); } },CFG.delay*1000); }
    else dSound(reason);
  }
  async function pull(){ if(!isRemote()) return; const r=await srvApi('GET','/api/security'); if(r.ok&&r.json){ S=r.json; draw(); } }
  const view=()=>isRemote()?S:{mode:D.mode,alarm:D.alarm,events:D.events.slice(0,80),armedAt:D.armedAt,cfg:CFG};
  async function setMode(m){
    if(isRemote()){ const r=await srvApi('POST','/api/security/mode',{mode:m}); if(r.ok) S=r.json; }
    else { clearTimeout(dTimer); const was=D.alarm.state; D.mode=m; D.armedAt=m==='off'?0:Date.now(); D.alarm={state:'idle'}; dEvent('mode',m==='off'?'Disarmed':'Armed: '+(m==='home'?'Home':'Away')); dSave(); if(was==='sounding'||prevLights) dFlashOff(); }
    draw();
  }
  async function ack(){
    if(isRemote()){ const r=await srvApi('POST','/api/security/ack',{}); if(r.ok) S=r.json; }
    else { clearTimeout(dTimer); const was=D.alarm.state; D.alarm={state:'idle'}; if(was!=='idle') dEvent('mode','Alarm silenced'); dSave(); dFlashOff(); }
    draw();
  }
  /* camera motion from this page goes to the alarm */
  window.__secView=()=>view();
  window.__secMotion=cam=>{
    if(isRemote()) srvApi('POST','/api/security/event',{cam}).then(r=>{ if(r.ok){ S=r.json; draw(); } });
    else { dEvent('motion','Motion at '+cam); if(D.mode!=='off') dTrigger('Motion at '+cam,false); draw(); }
  };
  if(typeof motionAt==='function'){ const _m=motionAt; motionAt=function(cam){ try{ window.__secMotion(cam); }catch(e){} return _m.apply(this,arguments); }; }
  /* demo-only: simulate a door sensor so the alarm can be tried */
  window.__secDemoDoor=()=>{ dEvent('sensor','Front door: opened'); if(D.mode!=='off') dTrigger('Front door triggered (door)',true); draw(); };
  const when=t=>new Date(t).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  const kind={motion:'camera',sensor:'sensor',lock:'lock',alarm:'alert',pending:'alert',mode:'shield'};
  function card(){
    let c=document.getElementById('secCard'); if(c) return c;
    const anchor=document.getElementById('moreBox')||document.getElementById('othBox')||document.getElementById('lights'); if(!anchor) return null;
    c=el('section','seccard'); c.id='secCard'; c.setAttribute('aria-label','Security');
    c.innerHTML='<div class="sechead"><span class="secic"></span><div><h3>Security</h3><p class="sub" id="secStat"></p></div></div>'+
      '<div class="secmodes" role="radiogroup" aria-label="Alarm mode"></div><div id="secAlarm" aria-live="assertive"></div>'+
      '<details class="secd" id="secTl"><summary>Timeline</summary><div id="secEv" class="secev"></div></details>'+
      '<details class="secd" id="secSn"><summary>Snapshots</summary><p class="sub" id="secSnNote"></p><div class="secsnaps" id="secSnaps"></div></details>'+
      '<details class="secd" id="secSet"><summary>Alarm settings</summary><div class="srow"><label for="secDelay">Entry and exit delay</label><select id="secDelay"></select></div><div class="srow"><span>Flash the lights red when the alarm sounds</span><button class="sw" role="switch" id="secFlash" aria-label="Flash the lights red when the alarm sounds"><i></i></button></div><p class="sub">Home watches doors, windows and cameras. Away watches everything, including motion sensors and unlocked locks. Phone alerts use your Phone alerts settings. Camera motion is only seen while a Lumora page is open.</p><div id="secDemo"></div></details>';
    c.querySelector('.secic').innerHTML=ICO('shield'); if(anchor.id==='moreBox') anchor.prepend(c); else anchor.insertAdjacentElement('afterend',c);
    const modes=c.querySelector('.secmodes'); [['off','Off'],['home','Home'],['away','Away']].forEach(([m,l])=>{ const b=el('button','secmode',l); b.type='button'; b.dataset.m=m; b.setAttribute('role','radio'); b.onclick=()=>setMode(m); modes.appendChild(b); });
    const sel=c.querySelector('#secDelay'); [0,10,20,30,60].forEach(v=>{ const o=el('option','',v?v+' seconds':'None'); o.value=v; sel.appendChild(o); }); sel.value=String(CFG.delay); sel.onchange=()=>{ CFG.delay=Number(sel.value); cfgSave(); };
    const fl=c.querySelector('#secFlash'); const pf=()=>{ fl.classList.toggle('on',!!CFG.flash); fl.setAttribute('aria-checked',String(!!CFG.flash)); }; pf(); fl.onclick=()=>{ CFG.flash=!CFG.flash; cfgSave(); pf(); };
    if(!isRemote()){ const b=el('button','btn sm','Try it: open the front door'); b.type='button'; b.id='secTry'; b.onclick=()=>window.__secDemoDoor(); c.querySelector('#secDemo').append(el('p','sub','Demo mode has no real sensors. Arm the alarm, then try it:'),b); }
    return c;
  }
  function snaps(){ try{ return JSON.parse(localStorage.getItem(SK)||'[]')||[]; }catch(e){ return []; } }
  function drawSnaps(){
    const box=document.getElementById('secSnaps'), note=document.getElementById('secSnNote'); if(!box) return; const list=snaps(); box.replaceChildren();
    note.textContent=list.length?'Saved on this device. The newest 12 are kept.':'No snapshots yet. A Save snapshot button appears on cameras that provide a picture (Aosu battery cameras do not).';
    list.forEach((s,i)=>{ const f=el('figure','secsnap'); const im=el('img'); im.src=s.d; im.alt='Snapshot of '+s.cam+' at '+new Date(s.t).toLocaleString(); const cap=el('figcaption','',s.cam+' · '+new Date(s.t).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})); const x=el('button','x','×'); x.type='button'; x.setAttribute('aria-label','Delete this snapshot'); x.onclick=()=>{ const l=snaps(); l.splice(i,1); try{ localStorage.setItem(SK,JSON.stringify(l)); }catch(e){} drawSnaps(); }; f.append(im,cap,x); box.appendChild(f); });
  }
  function addSnapButtons(){
    document.querySelectorAll('#cams .cam').forEach(cm=>{
      const img=cm.querySelector('img.livecam'); if(!img||cm.querySelector('.snapbtn')) return;
      const b=el('button','btn sm snapbtn','Save snapshot'); b.type='button';
      b.onclick=()=>{ try{ const c=document.createElement('canvas'); c.width=Math.min(640,img.naturalWidth||640); c.height=Math.round(c.width*((img.naturalHeight||360)/(img.naturalWidth||640))); c.getContext('2d').drawImage(img,0,0,c.width,c.height); const d=c.toDataURL('image/jpeg',.7); const l=snaps(); l.unshift({t:Date.now(),cam:img.dataset.cam||'Camera',d}); l.length=Math.min(l.length,12); localStorage.setItem(SK,JSON.stringify(l)); b.textContent='Saved'; setTimeout(()=>b.textContent='Save snapshot',1500); drawSnaps(); }catch(e){ b.textContent='Could not save'; setTimeout(()=>b.textContent='Save snapshot',1800); } };
      (cm.querySelector('.mrow')||cm).insertAdjacentElement('beforebegin',b);
    });
  }
  if(typeof renderCams==='function'){ const _rc=renderCams; renderCams=function(){ _rc.apply(this,arguments); try{ addSnapButtons(); }catch(e){} }; }
  function draw(){
    const c=card(); if(!c) return; const v=view(); const a=v.alarm||{state:'idle'};
    c.dataset.state=a.state; c.dataset.mode=v.mode;
    c.querySelectorAll('.secmode').forEach(b=>{ const on=b.dataset.m===v.mode; b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on)); });
    const st=c.querySelector('#secStat');
    st.textContent=a.state==='sounding'?'Alarm: '+(a.reason||''):a.state==='pending'?'Someone opened something. Disarm now to stop the alarm.':v.mode==='off'?'Disarmed':'Armed: '+(v.mode==='home'?'Home':'Away')+(v.armedAt?' since '+when(v.armedAt):'');
    const box=c.querySelector('#secAlarm'); box.replaceChildren();
    if(a.state==='pending'){ const left=Math.max(0,Math.ceil((a.until-Date.now())/1000)); const p=el('div','secbanner pend'); p.append(el('b','','Alarm in '+left+' s'),el('span','',a.reason||'')); const b=el('button','btn primary','Disarm'); b.type='button'; b.onclick=()=>setMode('off'); p.appendChild(b); box.appendChild(p); }
    if(a.state==='sounding'){ const p=el('div','secbanner snd'); p.append(el('b','','ALARM'),el('span','',a.reason||'')); const b1=el('button','btn','Silence'); b1.type='button'; b1.onclick=ack; const b2=el('button','btn primary','Disarm'); b2.type='button'; b2.onclick=()=>setMode('off'); p.append(b1,b2); box.appendChild(p); }
    const ev=c.querySelector('#secEv'); const list=(v.events||[]).slice(0,12); ev.replaceChildren(...(list.length?list.map(e=>{ const r=el('div','secrow '+e.k); const i=el('span','secri'); i.innerHTML=ICO(kind[e.k]||'bolt'); r.append(i,el('span','sect',e.m),el('span','secw',new Date(e.t).toLocaleDateString()===new Date().toLocaleDateString()?when(e.t):new Date(e.t).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))); return r; }):[el('p','sub','Nothing yet. Camera motion, doors, locks and alarms are listed here.')]));
    drawSnaps();
  }
  const boot=()=>{ card(); draw(); pull(); setInterval(()=>{ if(document.hidden) return; if(isRemote()) pull(); else draw(); },1000); if(typeof EventSource!=='undefined'&&isRemote()){ try{ const es=new EventSource('/api/events'); es.addEventListener('security',()=>pull()); }catch(e){} } };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',()=>setTimeout(boot,900)); else setTimeout(boot,900);
  new MutationObserver(()=>{ if(document.body.dataset.auth==='in'){ card(); pull(); } }).observe(document.body,{attributes:true,attributeFilter:['data-auth']});
})();
