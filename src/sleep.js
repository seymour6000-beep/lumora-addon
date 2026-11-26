
/* ---- Lumora 6.1: sleep mode (fade a room to warm and off) ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const el=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; };
  const CK='hub-sleep', DK='hub-sleepdemo';
  const cfgLoad=()=>{ let v={}; try{ v=JSON.parse(localStorage.getItem(CK)||'{}')||{}; }catch(e){} return Object.assign({minutes:30,room:'Bedroom',bedtime:'',warm:true},v); };
  let CFG=cfgLoad(); const cfgSave=()=>{ try{ store.set(CK,CFG); }catch(e){ try{ localStorage.setItem(CK,JSON.stringify(CFG)); }catch(x){} } };
  const isRemote=()=>typeof REMOTE!=='undefined'&&REMOTE;
  let S={active:false,room:CFG.room,minutes:CFG.minutes,startedAt:0,endsAt:0};
  let D=null; try{ D=JSON.parse(localStorage.getItem(DK)||'null'); if(D&&Date.now()>D.startedAt+D.minutes*60000+60000) D=null; }catch(e){}
  const dSave=()=>{ try{ if(D) localStorage.setItem(DK,JSON.stringify(D)); else localStorage.removeItem(DK); }catch(e){} };
  const roomsNow=()=>[...new Set((state||[]).map(d=>d.room||'Home'))].sort();
  const view=()=>isRemote()?S:(D?{active:true,room:D.room,minutes:D.minutes,startedAt:D.startedAt,endsAt:D.startedAt+D.minutes*60000}:{active:false,room:CFG.room,minutes:CFG.minutes,startedAt:0,endsAt:0});
  async function pull(){ if(!isRemote()) return; const r=await srvApi('GET','/api/sleep'); if(r.ok&&r.json){ S=r.json; draw(); } }
  async function dTick(){
    if(!D) return; const p=Math.min(1,(Date.now()-D.startedAt)/(D.minutes*60000));
    try{
      for(const l of D.from){ if(p>=1) await adapter.set(l.id,{on:false}); else await adapter.set(l.id,{on:true,bri:Math.max(1,Math.round(l.bri*(1-p))),color:CFG.warm?'#ffb36b':undefined}); }
      state=await adapter.list(); render();
    }catch(e){}
    if(p>=1){ D=null; dSave(); try{ log('Sleep mode finished'); }catch(e){} draw(); }
  }
  async function start(){
    const msg=document.getElementById('slMsg'); const say=t=>{ if(msg) msg.textContent=t; try{ if(t) toast(t); }catch(e){} };
    if(isRemote()){ const r=await srvApi('POST','/api/sleep/start',{minutes:CFG.minutes}); if(r.ok){ S=r.json; say(''); } else say((r.json&&r.json.error&&r.json.error.message)||(r.json&&r.json.message)||'Could not start sleep mode.'); draw(); return; }
    const lights=(state||[]).filter(d=>(d.room||'Home')===CFG.room&&d.online!==false&&d.on);
    if(!lights.length){ say('The '+CFG.room+' lights are already off.'); return; }
    D={room:CFG.room,minutes:CFG.minutes,startedAt:Date.now(),from:lights.map(l=>({id:l.id,bri:l.bri||100}))}; dSave(); try{ log('Sleep mode started in '+CFG.room); }catch(e){} say(''); await dTick(); draw();
  }
  async function cancel(){ if(isRemote()){ const r=await srvApi('POST','/api/sleep/cancel',{}); if(r.ok) S=r.json; } else { D=null; dSave(); } draw(); }
  window.__sleepStart=start; window.__sleepCancel=cancel; window.__sleepView=view;
  const left=v=>{ const m=Math.max(0,Math.ceil((v.endsAt-Date.now())/60000)); return m<=1?'less than a minute':m+' minutes'; };
  function bar(){
    let c=document.getElementById('sleepCard'); const v=view();
    if(!v.active){ if(c) c.remove(); return; }
    if(!c){ const a=document.getElementById('secCard')||document.getElementById('moreBox')||document.getElementById('lights'); if(!a) return; c=el('section','sleepcard'); c.id='sleepCard'; c.setAttribute('role','status'); if(a.id==='moreBox') a.prepend(c); else a.insertAdjacentElement('afterend',c); }
    c.replaceChildren(); const ic=el('span','slic'); ic.innerHTML=ICO('moon'); const tx=el('div','sltx'); tx.append(el('b','','Sleep mode in '+v.room),el('span','',left(v)+' until the lights are off'));
    const prog=el('div','slprog'); const f=el('i'); f.style.width=Math.min(100,Math.max(2,((Date.now()-v.startedAt)/(v.endsAt-v.startedAt))*100))+'%'; prog.appendChild(f);
    const b=el('button','btn sm','Stop'); b.type='button'; b.onclick=cancel; c.append(ic,tx,b,prog);
  }
  function roomBtn(){
    document.querySelectorAll('#roomChips .rcard').forEach(card=>{
      const rn=card.querySelector('.rn'); if(!rn||rn.textContent!==CFG.room){ const o=card.querySelector('.rsleep'); if(o) o.remove(); return; }
      if(card.querySelector('.rsleep')) return;
      const b=el('button','rsleep'); b.type='button'; b.setAttribute('aria-label','Start sleep mode in '+CFG.room); b.innerHTML=ICO('moon')+'<span>Sleep</span>'; b.onclick=()=>{ view().active?cancel():start(); };
      let ft=card.querySelector('.rfoot'); if(!ft){ ft=el('div','rfoot'); const sh=card.querySelector('.rshow'); if(sh){ card.insertBefore(ft,sh); ft.append(b,sh); } else { ft.append(b); card.append(ft); } } else ft.prepend(b);
    });
    document.querySelectorAll('#roomChips .rsleep span').forEach(s=>s.textContent=view().active?'Stop sleep':'Sleep');
  }
  if(typeof window.renderRoomChips==='function'){ const _r=window.renderRoomChips; window.renderRoomChips=function(){ _r.apply(this,arguments); try{ roomBtn(); }catch(e){} }; }
  function panel(){
    const grid=document.querySelector('section[data-tab="Settings"] .sgrid'); if(!grid) return null;
    let p=document.getElementById('sleepPanel'); if(p) return p;
    p=el('div','panel'); p.id='sleepPanel';
    p.innerHTML='<h3>Sleep mode</h3><p class="sub">Fades the lights in one room down to a dim, warm glow and then off. On the add-on it carries on even if you close this page.</p>'+
      '<div class="srow"><label for="slRoom">Room</label><select id="slRoom"></select></div>'+
      '<div class="srow"><label for="slMin">Fade over</label><select id="slMin"></select></div>'+
      '<div class="srow"><label for="slBed">Start by itself at</label><span class="slbed"><input type="time" id="slBed" class="in"><button class="btn sm" type="button" id="slBedX">Off</button></span></div>'+
      '<div class="srow"><span>Warm light while dimming</span><button class="sw" role="switch" id="slWarm" aria-label="Warm light while dimming"><i></i></button></div>'+
      '<div class="nrow"><button class="btn primary" type="button" id="slGo">Start sleep mode now</button></div><p class="sub" id="slMsg" role="status"></p>';
    grid.appendChild(p);
    const mins=p.querySelector('#slMin'); [5,10,15,20,30,45,60,90].forEach(m=>{ const o=el('option','',m+' minutes'); o.value=m; mins.appendChild(o); }); mins.value=String(CFG.minutes); mins.onchange=()=>{ CFG.minutes=Number(mins.value); cfgSave(); };
    p.querySelector('#slBed').value=CFG.bedtime||''; p.querySelector('#slBed').onchange=e=>{ CFG.bedtime=e.target.value||''; cfgSave(); };
    p.querySelector('#slBedX').onclick=()=>{ CFG.bedtime=''; p.querySelector('#slBed').value=''; cfgSave(); };
    const w=p.querySelector('#slWarm'); const pw=()=>{ w.classList.toggle('on',!!CFG.warm); w.setAttribute('aria-checked',String(!!CFG.warm)); }; pw(); w.onclick=()=>{ CFG.warm=!CFG.warm; cfgSave(); pw(); };
    p.querySelector('#slGo').onclick=()=>{ view().active?cancel():start(); };
    return p;
  }
  function draw(){
    const p=panel(); if(p){ const sel=p.querySelector('#slRoom'); const rooms=[...new Set(roomsNow().concat([CFG.room]))];
      if(sel.options.length!==rooms.length||[...sel.options].some((o,i)=>o.value!==rooms[i])){ sel.replaceChildren(...rooms.map(r=>{ const o=el('option','',r); o.value=r; return o; })); sel.onchange=()=>{ CFG.room=sel.value; cfgSave(); draw(); }; }
      sel.value=CFG.room; p.querySelector('#slGo').textContent=view().active?'Stop sleep mode':'Start sleep mode now'; }
    bar(); roomBtn();
  }
  const boot=()=>{ draw(); pull(); if(D) dTick(); setInterval(()=>{ if(document.hidden) return; if(isRemote()) pull(); else if(D) dTick(); draw(); },5000); setInterval(()=>{ if(!document.hidden) bar(); },20000); if(typeof EventSource!=='undefined'&&isRemote()){ try{ const es=new EventSource('/api/events'); es.addEventListener('sleep',()=>pull()); }catch(e){} } };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',()=>setTimeout(boot,1000)); else setTimeout(boot,1000);
})();
