
/* ---- Lumora 6.1: Bluetooth (find and connect to nearby devices from this browser) ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const KEY='hub-bt', nav=navigator.bluetooth;
  const el=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; };
  const saved=()=>{ try{ const v=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } };
  const keep=l=>{ try{ localStorage.setItem(KEY,JSON.stringify(l.slice(0,20))); }catch(e){} };
  const live=new Map(); let err='', busy=false, avail=null, note='';
  try{ if(nav&&nav.getAvailability){ nav.getAvailability().then(v=>{ avail=v; draw(); }).catch(()=>{}); if(nav.addEventListener) nav.addEventListener('availabilitychanged',e=>{ avail=e.value; draw(); }); } }catch(e){}
  const friendly=e=>{ const m=String((e&&e.name)||''); if(m==='NotFoundError') return ''; if(m==='SecurityError'||m==='NotAllowedError') return 'Bluetooth is blocked. Allow it for this site in the browser, then try again.'; if(m==='NetworkError') return 'Could not connect. Move closer and make sure the device is on and not paired to something else.'; return 'Bluetooth problem: '+String((e&&e.message)||m).slice(0,80); };
  window.__btLamp=()=>{
    if(!nav) return {lv:'warn',txt:'Not available in this browser'};
    if(err) return {lv:'bad',txt:err.slice(0,60)};
    if(avail===false) return {lv:'warn',txt:'Bluetooth is off or missing'};
    if(live.size) return {lv:'ok',txt:live.size+(live.size===1?' device connected':' devices connected')};
    if(saved().length) return {lv:'warn',txt:'No device connected'};
    return {lv:'ok',txt:'Ready, nothing paired'};
  };
  window.__btState=()=>({supported:!!nav,avail,connected:[...live.values()].map(x=>x.dev.name||'Device'),saved:saved().length,err});
  async function connect(dev){
    busy=true; draw();
    try{
      const srv=await dev.gatt.connect(); live.set(dev.id,{dev,srv}); err='';
      if(!dev.__lum){ dev.__lum=1; dev.addEventListener('gattserverdisconnected',()=>{ live.delete(dev.id); draw(); try{ window.__refreshLamps&&window.__refreshLamps(); }catch(e){} }); }
      try{ const s=await srv.getPrimaryService('battery_service'); const c=await s.getCharacteristic('battery_level'); const v=await c.readValue(); live.get(dev.id).battery=v.getUint8(0); }catch(e){ /* no battery service */ }
    }catch(e){ err=friendly(e); }
    busy=false; draw(); try{ window.__refreshLamps&&window.__refreshLamps(); }catch(e){}
  }
  async function pair(){
    if(!nav||busy) return; err=''; note='';
    try{
      const dev=await nav.requestDevice({acceptAllDevices:true,optionalServices:['battery_service','device_information']});
      const l=saved().filter(x=>x.id!==dev.id); l.unshift({id:dev.id,name:dev.name||'Bluetooth device',t:Date.now()}); keep(l);
      await connect(dev);
    }catch(e){ err=friendly(e); if(!err) note='No device was chosen.'; draw(); }
  }
  async function known(){ try{ return nav&&nav.getDevices?await nav.getDevices():[]; }catch(e){ return []; } }
  async function reconnect(){
    if(!nav) return; const ds=await known(); const ids=new Set(saved().map(x=>x.id));
    for(const d of ds){ if(ids.has(d.id)&&!live.has(d.id)){ try{ await connect(d); }catch(e){} } }
  }
  async function forget(id){
    const d=live.get(id); try{ if(d&&d.dev.gatt.connected) d.dev.gatt.disconnect(); }catch(e){} live.delete(id);
    try{ const ds=await known(); const x=ds.find(z=>z.id===id); if(x&&x.forget) await x.forget(); }catch(e){}
    keep(saved().filter(x=>x.id!==id)); draw();
  }
  function panel(){
    const grid=document.querySelector('section[data-tab="Settings"] .sgrid'); if(!grid) return null;
    let p=document.getElementById('btPanel'); if(p) return p;
    p=el('div','panel wide'); p.id='btPanel';
    p.innerHTML='<h3>Bluetooth</h3><p class="sub" id="btStat"></p><div class="nrow"><button class="btn primary" id="btPair" type="button">Find a device</button></div><div id="btList" class="btlist"></div><p class="sub" id="btNote" role="status"></p>'+
      '<details class="secd"><summary>Can other devices find Lumora over Bluetooth?</summary><p class="sub">Not yet. A web page can look for Bluetooth devices and connect to them, but a browser cannot announce itself, so phones and speakers will not see Lumora in their Bluetooth lists. Making Lumora discoverable needs Bluetooth access on the computer that runs Home Assistant. If you want that, the Home Assistant Bluetooth integration is the place to start: it discovers nearby devices and shares them with Lumora like any other device.</p></details>';
    grid.appendChild(p); p.querySelector('#btPair').onclick=pair; return p;
  }
  function draw(){
    const p=panel(); if(!p) return; const st=window.__btLamp();
    p.querySelector('#btStat').textContent=!nav?'This browser cannot use Bluetooth. Chrome, Edge and the Lumora desktop app can, and the page must be opened over HTTPS or on this computer.':st.txt+'.';
    const btn=p.querySelector('#btPair'); btn.disabled=!nav||busy; btn.textContent=busy?'Working…':'Find a device';
    p.querySelector('#btNote').textContent=note;
    const box=p.querySelector('#btList'); box.replaceChildren();
    saved().forEach(d=>{ const r=el('div','btrow'); const on=live.get(d.id); const dot=el('span','btdot'); dot.dataset.on=on?'1':'0';
      const nm=el('span','btn_',d.name+(on&&on.battery!=null?' · '+on.battery+'% battery':'')); const sub=el('em','',on?'Connected':'Not connected');
      const a=el('div','btact'); const b1=el('button','btn sm',on?'Disconnect':'Connect'); b1.type='button';
      b1.onclick=async()=>{ if(on){ try{ on.dev.gatt.disconnect(); }catch(e){} live.delete(d.id); draw(); } else { const ds=await known(); const x=ds.find(z=>z.id===d.id); if(x) connect(x); else { note='Press Find a device to choose it again.'; draw(); } } };
      const b2=el('button','btn sm','Forget'); b2.type='button'; b2.onclick=()=>forget(d.id); a.append(b1,b2);
      const tx=el('span','bttx'); tx.append(nm,sub); r.append(dot,tx,a); box.appendChild(r); });
    if(!saved().length) box.appendChild(el('p','sub','Nothing paired yet. Press Find a device and pick one from the list your browser shows.'));
  }
  const boot=()=>{ draw(); reconnect(); setInterval(()=>{ if(!document.hidden) draw(); },4000); };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',()=>setTimeout(boot,1200)); else setTimeout(boot,1200);
})();
