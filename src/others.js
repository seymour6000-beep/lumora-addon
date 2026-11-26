
/* ---- Lumora 3.2: other devices, roles, two-step sign-in, usage history ---- */
(function(){
  const ROLE=(SRV&&SRV.user&&SRV.user.role)||'admin';
  const CAN_MONEY=!SRV||!SRV.user||SRV.user.money!==false;
  const body=document.body;
  body.dataset.role=ROLE; body.dataset.money=CAN_MONEY?'1':'0';
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const el=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  const say=r=>(r.json&&r.json.message)||'Something went wrong. Try again.';
  const hasTab=n=>!(n==='Money'&&!CAN_MONEY)&&!(ROLE==='guest'&&(n==='Money'||n==='Automations'||n==='Activity'));

  /* ---------- roles: hide what an account should not see ---------- */
  const _show=showTab; showTab=function(n){ if(!hasTab(n)) n='Devices'; return _show(n); };
  if(!hasTab(localStorage.getItem('hub-tab')||'Devices')) try{ localStorage.setItem('hub-tab','Devices'); }catch(e){}
  function applyRole(){
    document.querySelectorAll('section[data-tab="Settings"] .sgrid > .panel').forEach(p=>{
      let hide=false;
      if(ROLE==='guest') hide=!p.querySelector('#pwSave');
      else if(ROLE!=='admin') hide=p.id==='notifyPanel'||p.id==='healthPanel'||p.id==='hhPanel';
      p.classList.toggle('rolehide',hide);
    });
  }
  /* ---------- usage history ---------- */
  const HK='hub-history';
  let hist={days:{},events:[],names:{},last:{}}; try{ const h=JSON.parse(localStorage.getItem(HK)||'null'); if(h&&h.days) hist=h; }catch(e){}
  const dayKey=t=>{ const d=new Date(t); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  let hT=0;
  function recordLocal(){
    if(REMOTE||!state.length) return; const now=Date.now(), dt=hT?Math.min(15,(now-hT)/1000):0; hT=now;
    const day=hist.days[dayKey(now)]||(hist.days[dayKey(now)]={});
    state.forEach(l=>{
      hist.names[l.id]=l.name; const st=l.online===false?'offline':l.on?'on':'off', prev=hist.last[l.id];
      if(l.online!==false&&l.on&&dt) day[l.id]=Math.round(((day[l.id]||0)+dt)*10)/10;
      if(prev!==st){ if(prev!==undefined||st==='offline') hist.events.push({t:now,id:l.id,name:l.name,type:st==='offline'?'offline':prev==='offline'?'online':st}); hist.last[l.id]=st; }
    });
    if(hist.events.length>600) hist.events.splice(0,hist.events.length-600);
    Object.keys(hist.days).sort().slice(0,-60).forEach(k=>delete hist.days[k]);
    try{ localStorage.setItem(HK,JSON.stringify(hist)); }catch(e){}
  }
  setInterval(()=>{ if(!document.hidden) try{ recordLocal(); }catch(e){} },15000);
  const hrs=s=>{ s=Math.round(s); if(s<60) return s?'<1 min':'0 min'; const m=Math.round(s/60); return m<60?m+' min':(Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':'')); };
  const dur=ms=>hrs(ms/1000);
  let histDays=7;
  async function loadHist(n){
    if(REMOTE){ const r=await srvApi('GET','/api/history?days='+n); return r.ok?r.json:null; }
    const out=[], now=Date.now();
    for(let i=n-1;i>=0;i--){ const dk=dayKey(now-i*864e5), by=hist.days[dk]||{}; out.push({date:dk,sec:Math.round(Object.values(by).reduce((a,b)=>a+b,0)),by}); }
    return {days:out,names:hist.names,events:hist.events.filter(e=>e.t>=now-n*864e5).slice(-400),now};
  }
  async function renderHist(){
    const box=$('histBox'); if(!box) return;
    const h=await loadHist(histDays); const out=$('histOut'); out.innerHTML='';
    if(!h){ out.appendChild(el('p','sub','History isn’t available right now.')); return; }
    const total=h.days.reduce((a,d)=>a+d.sec,0), max=Math.max(1,...h.days.map(d=>d.sec));
    if(!total&&!h.events.length){ out.appendChild(el('p','note','Nothing recorded yet. Lumora starts counting the moment a light is on, so check back after a day or two.')); return; }
    const W=Math.max(1,Math.min(200,+settings.lightWatts||9)), P=Math.max(0,+settings.kwhPrice>=0&&settings.kwhPrice!==''&&settings.kwhPrice!=null?+settings.kwhPrice:0.19), kwh=total/3600*W/1000;
    out.appendChild(el('p','histsum energy','Estimated energy: '+(kwh<10?kwh.toFixed(2):kwh.toFixed(1))+' kWh, about $'+(kwh*P).toFixed(2)+' ('+W+' W per light at $'+P.toFixed(2)+' per kWh).'));
    const best=h.days.reduce((a,d)=>d.sec>a.sec?d:a,h.days[0]);
    out.appendChild(el('p','histsum','Lights were on for '+hrs(total)+' in the last '+histDays+' days'+(total?', most on '+new Date(best.date+'T12:00:00').toLocaleDateString([], {weekday:'long'})+' ('+hrs(best.sec)+').':'.')));
    const chart=el('div','hbars'); chart.setAttribute('role','img'); chart.setAttribute('aria-label','Hours the lights were on, per day');
    h.days.forEach(d=>{ const c=el('div','hcol'); const bar=el('i'); bar.style.height=Math.max(d.sec?3:0,d.sec/max*100)+'%'; bar.title=new Date(d.date+'T12:00:00').toLocaleDateString([], {weekday:'long',month:'short',day:'numeric'})+': '+hrs(d.sec); c.appendChild(bar); const l=el('span',null,histDays>14?(+d.date.slice(8)%5===0?String(+d.date.slice(8)):''):new Date(d.date+'T12:00:00').toLocaleDateString([], {weekday:'narrow'})); c.appendChild(l); chart.appendChild(c); });
    out.appendChild(chart);
    const per={}; h.days.forEach(d=>Object.entries(d.by||{}).forEach(([id,s])=>per[id]=(per[id]||0)+s));
    const rows=Object.entries(per).sort((a,b)=>b[1]-a[1]), top=rows.length?rows[0][1]:1;
    if(rows.length){ out.appendChild(el('h3','hh','By light')); const ul=el('ul','hlist'); rows.forEach(([id,s])=>{ const li=el('li'); li.appendChild(el('span',null,h.names[id]||id)); const b=el('span','hb'); const i=el('i'); i.style.width=Math.max(2,s/top*100)+'%'; b.appendChild(i); li.appendChild(b); li.appendChild(el('b',null,hrs(s))); ul.appendChild(li); }); out.appendChild(ul); }
    const offs=[]; const ev=h.events.slice().sort((a,b)=>a.t-b.t); const openAt={};
    ev.forEach(e=>{ if(e.type==='offline') openAt[e.id]=e; else if(e.type==='online'&&openAt[e.id]){ offs.push({name:e.name,t:openAt[e.id].t,end:e.t}); delete openAt[e.id]; } });
    Object.values(openAt).forEach(e=>offs.push({name:e.name,t:e.t,end:null}));
    offs.sort((a,b)=>b.t-a.t);
    out.appendChild(el('h3','hh','Offline events'));
    if(!offs.length) out.appendChild(el('p','sub','No lights went offline in this time.'));
    else{ const ul=el('ul','log'); offs.slice(0,30).forEach(o=>{ const li=el('li'); li.textContent=new Date(o.t).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:settings.timeFormat!=='24'})+'  '+o.name+' went offline'+(o.end?' for '+dur(o.end-o.t):' and has not come back'); ul.appendChild(li); }); out.appendChild(ul); }
  }
  async function exportCsv(){
    const h=await loadHist(histDays); if(!h) return toast('History isn’t available right now.');
    const W=Math.max(1,Math.min(200,+settings.lightWatts||9)); const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
    const ids=[...new Set(h.days.flatMap(d=>Object.keys(d.by||{})))];
    let t='Date,'+ids.map(i=>q((h.names[i]||i)+' (minutes on)')).join(',')+',Total minutes on,Estimated kWh\n';
    h.days.forEach(d=>{ t+=d.date+','+ids.map(i=>Math.round((d.by[i]||0)/60)).join(',')+','+Math.round(d.sec/60)+','+(d.sec/3600*W/1000).toFixed(3)+'\n'; });
    t+='\nOffline events\nTime,Light,Event\n'; h.events.forEach(e=>{ t+=new Date(e.t).toISOString()+','+q(e.name)+','+e.type+'\n'; });
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'})); a.download='lumora-history-'+dayKey(Date.now())+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
  }
  window.__exportCsv=exportCsv;
  window.__renderHist=renderHist;

  /* ---------- other devices ---------- */
  let others=[]; try{ const o=JSON.parse(localStorage.getItem('hub-others')||'[]'); if(Array.isArray(o)) others=o.filter(x=>x&&typeof x.id==='string'&&x.kind); }catch(e){}
  const saveOthers=()=>{ try{ localStorage.setItem('hub-others',JSON.stringify(others)); }catch(e){} };
  let live={};          /* id -> latest state */
  const KIND={plug:'Smart plug',sensor:'Sensor',lock:'Lock',thermostat:'Thermostat'};
  const DEMO={
    'switch.desk_lamp':{id:'switch.desk_lamp',name:'Desk lamp plug',kind:'plug',on:false,online:true},
    'binary_sensor.front_door':{id:'binary_sensor.front_door',name:'Front door',kind:'sensor',cls:'door',label:'Door',active:false,online:true},
    'binary_sensor.hall_motion':{id:'binary_sensor.hall_motion',name:'Hall motion',kind:'sensor',cls:'motion',label:'Motion',active:false,online:true},
    'climate.hall':{id:'climate.hall',name:'Hall thermostat',kind:'thermostat',temp:19.5,target:21,mode:'heat',action:'heating',modes:['off','heat'],min:5,max:30,step:.5,unit:'°C',online:true},
    'lock.front':{id:'lock.front',name:'Front door lock',kind:'lock',locked:true,state:'locked',online:true}
  };
  const sensorWords=cls=>/^(door|window|garage_door|opening)$/.test(cls)?['Open','Closed']:/^(motion|occupancy|presence|vibration|sound)$/.test(cls)?['Motion','Clear']:/^(smoke|gas|carbon_monoxide|moisture|safety|tamper)$/.test(cls)?['Detected','Clear']:['Active','Normal'];
  const nameOfO=id=>{ const o=others.find(x=>x.id===id); return o?o.name:(live[id]&&live[id].name)||id; };
  async function othFetch(ids){
    if(REMOTE){ const r=await srvApi('POST','/api/others/state',{ids}); return r.ok?(r.json.states||{}):null; }
    const t=DEMO['climate.hall']; if(t.mode==='heat'&&t.temp<t.target) t.temp=Math.min(t.target,Math.round((t.temp+.1)*10)/10); else if(t.temp>t.target+.3) t.temp=Math.round((t.temp-.1)*10)/10;
    const o={}; ids.forEach(i=>{ if(DEMO[i]) o[i]=JSON.parse(JSON.stringify(DEMO[i])); }); return o;
  }
  async function othSet(id,patch){
    if(REMOTE){ const r=await srvApi('POST','/api/others/'+encodeURIComponent(id)+'/set',patch); if(!r.ok){ toast(say(r)); return false; } return true; }
    const d=DEMO[id]; if(!d) return false; if('on' in patch) d.on=patch.on; if('locked' in patch){ d.locked=patch.locked; d.state=patch.locked?'locked':'unlocked'; } if('target' in patch) d.target=patch.target; if('mode' in patch) d.mode=patch.mode; return true;
  }
  async function othPoll(){
    if(!others.length) return; const ids=others.map(o=>o.id), s=await othFetch(ids); if(!s) return;
    const old=live; live={}; ids.forEach(i=>{ if(s[i]) live[i]=s[i]; });
    ids.forEach(i=>{ if(old[i]&&live[i]) transition(old[i],live[i]); });
    drawOthers();
  }
  window.__pollOthers=othPoll; window.__othLive=()=>({others,live,sensorWords}); window.__othAction=async(id,patch)=>{ if(await othSet(id,patch)) await othPoll(); };
  function transition(a,b){
    const nm=nameOfO(b.id);
    if(b.kind==='sensor'&&a.active!==b.active){ const w=sensorWords(b.cls); log(nm+': '+(b.active?w[0]:w[1])); if(b.active&&settings.popups&&ROLE!=='guest') toast(nm+': '+w[0].toLowerCase()); fireOth('sensor',{id:b.id,ev:b.active?'on':'off'}); }
    if(b.kind==='lock'&&a.locked!==b.locked){ log(nm+(b.locked?' locked':' unlocked')); fireOth('lockev',{id:b.id,ev:b.locked?'locked':'unlocked'}); }
    if(b.kind==='plug'&&a.on!==b.on) log(nm+(b.on?' turned on':' turned off'));
    if(b.kind==='thermostat'&&a.temp!=null&&b.temp!=null&&a.temp!==b.temp){
      rules.filter(r=>r.on&&r.t.type==='temp'&&(r.t.id==='any'||r.t.id===b.id)).forEach(r=>{ const lim=+r.t.deg, hit=v=>r.t.dir==='above'?v>lim:v<lim; if(!hit(a.temp)&&hit(b.temp)) runRule(r,{ctx:{dev:b.id}}); });
    }
  }
  function fireOth(type,ctx){ rules.filter(r=>r.on&&r.t.type===type&&(r.t.id==='any'||r.t.id===ctx.id)&&r.t.ev===ctx.ev).forEach(r=>runRule(r,{ctx})); }
  window.__othCond=c=>{ const s=live[c.id]; if(!s) return false; return (!!s.active)===(c.v==='active'); };
  window.__othAct=async a=>{
    const ids=a.id==='all'?others.filter(o=>o.kind===a.k2).map(o=>o.id):[a.id];
    for(const id of ids){
      const cur=live[id]||{};
      if(a.k==='plug') await othSet(id,{on:a.op==='toggle'?!cur.on:a.op==='on'});
      else if(a.k==='therm') await othSet(id,{target:+a.target});
      else if(a.k==='lock') await othSet(id,{locked:true});   /* automations can lock, never unlock */
    }
    await othPoll();
  };
  const optsOf=(kind,any)=>()=>(any?[['any','Any of them']]:[]).concat(others.filter(o=>o.kind===kind).map(o=>[o.id,o.name]));
  const sensorsOpt=()=>[['any','Any sensor']].concat(others.filter(o=>o.kind==='sensor').map(o=>[o.id,o.name]));
  Object.assign(TRIG,{
    sensor:{l:'A door or motion sensor changes',f:[{n:'id',t:'sel',l:'Sensor',o:sensorsOpt,d:'any'},{n:'ev',t:'sel',l:'When it',o:[['on','Opens or detects something'],['off','Closes or clears']],d:'on'}]},
    lockev:{l:'A lock is locked or unlocked',f:[{n:'id',t:'sel',l:'Lock',o:optsOf('lock',true),d:'any'},{n:'ev',t:'sel',l:'When it is',o:[['unlocked','Unlocked'],['locked','Locked']],d:'unlocked'}]},
    temp:{l:'A room gets too warm or too cold',f:[{n:'id',t:'sel',l:'Thermostat',o:optsOf('thermostat',true),d:'any'},{n:'dir',t:'sel',l:'When it goes',o:[['above','Above'],['below','Below']],d:'above'},{n:'deg',t:'num',l:'Degrees',d:24,min:-30,max:60}]}
  });
  Object.assign(ACT,{
    plug:{l:'Turn a smart plug on or off',f:[{n:'id',t:'sel',l:'Plug',o:()=>[['all','All plugs']].concat(others.filter(o=>o.kind==='plug').map(o=>[o.id,o.name])),d:'all'},{n:'op',t:'sel',l:'Do',o:[['on','Turn on'],['off','Turn off'],['toggle','Toggle']],d:'on'}]},
    therm:{l:'Set a thermostat',f:[{n:'id',t:'sel',l:'Thermostat',o:()=>others.filter(o=>o.kind==='thermostat').map(o=>[o.id,o.name])},{n:'target',t:'num',l:'Target temperature',d:21,min:5,max:30}]},
    lock:{l:'Lock a door',f:[{n:'id',t:'sel',l:'Lock',o:()=>[['all','All locks']].concat(others.filter(o=>o.kind==='lock').map(o=>[o.id,o.name])),d:'all'}]}
  });
  Object.assign(COND,{othstate:{l:'A door or sensor is open or closed',f:[{n:'id',t:'sel',l:'Sensor',o:()=>others.filter(o=>o.kind==='sensor').map(o=>[o.id,o.name])},{n:'v',t:'sel',l:'Is',o:[['active','Open or detecting'],['inactive','Closed or clear']],d:'inactive'}]}});
  window.__othText=(k,x)=>{
    const n=x.id==='any'||x.id==='all'?null:nameOfO(x.id);
    if(k==='sensor'){ const s=live[x.id]; const w=sensorWords(s?s.cls:'door'); return (n||'any sensor')+(x.ev==='on'?' ('+w[0].toLowerCase()+')':' ('+w[1].toLowerCase()+')')+' changes'; }
    if(k==='lockev') return (n||'any lock')+' is '+x.ev;
    if(k==='temp') return (n||'a thermostat')+' goes '+x.dir+' '+x.deg+'°';
    if(k==='plug') return (x.op==='toggle'?'toggle ':x.op==='off'?'turn off ':'turn on ')+(n||'all plugs');
    if(k==='therm') return 'set '+n+' to '+x.target+'°';
    if(k==='lock') return 'lock '+(n||'all locks');
    if(k==='othstate') return n+' is '+(x.v==='active'?'open or detecting':'closed or clear');
    return '';
  };

  const ICON={
    plug:'<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v5"/>',
    sensor:'<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    lock:'<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    thermostat:'<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>'
  };
  const svg=k=>ICO({plug:'plug',sensor:'sensor',lock:'lock',thermostat:'thermo'}[k]||'bulb');
  const fmtT=(v,u)=>v==null?'—':(Math.round(v*10)/10)+(u||'°');
  function card(o){
    const s=live[o.id], c=el('div','ot'); c.dataset.kind=o.kind;
    const head=el('div','oth'); const ic=el('span','oi'); ic.innerHTML=svg(o.kind); head.appendChild(ic);
    const nm=el('div','on'); nm.appendChild(el('b',null,o.name)); head.appendChild(nm);
    if(ROLE!=='guest'){ const rm=el('button','orm','×'); rm.type='button'; rm.setAttribute('aria-label','Remove '+o.name); rm.title='Remove from Lumora'; rm.onclick=()=>{ others=others.filter(x=>x.id!==o.id); delete live[o.id]; saveOthers(); drawOthers(); }; head.appendChild(rm); }
    c.appendChild(head);
    const sub=el('div','sub'); const act=el('div','oact');
    if(!s){ sub.textContent='Waiting for Home Assistant…'; c.dataset.off='1'; }
    else if(s.online===false){ sub.textContent='Offline'; c.dataset.off='1'; }
    else if(o.kind==='plug'){ sub.textContent=s.on?'On':'Off'; c.dataset.on=s.on?'1':'0'; const b=el('button','btn',s.on?'Turn off':'Turn on'); b.type='button'; b.onclick=async()=>{ if(await othSet(o.id,{on:!s.on})) othPoll(); }; act.appendChild(b); }
    else if(o.kind==='sensor'){ const w=sensorWords(s.cls); sub.textContent=(s.active?w[0]:w[1])+(s.changed?' · since '+new Date(s.changed).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',hour12:settings.timeFormat!=='24'}):''); c.dataset.on=s.active?'1':'0'; c.dataset.alert=s.active?'1':'0';
      if(!REMOTE){ const b=el('button','btn',s.active?'Test: '+w[1].toLowerCase():'Test: '+w[0].toLowerCase()); b.type='button'; b.title='Practice mode: change this sensor to test an automation'; b.onclick=()=>{ DEMO[o.id].active=!DEMO[o.id].active; DEMO[o.id].changed=Date.now(); othPoll(); }; act.appendChild(b); } }
    else if(o.kind==='lock'){ sub.textContent=s.locked?'Locked':(s.state==='unlocked'?'Unlocked':s.state||'Unknown'); c.dataset.on=s.locked?'0':'1'; c.dataset.alert=s.locked?'0':'1';
      if(ROLE==='guest') sub.textContent+=' · view only'; else{
        const b=el('button','btn',s.locked?'Unlock':'Lock'); b.type='button';
        if(s.locked) confirmBtn(b,async()=>{ if(await othSet(o.id,{locked:false})) othPoll(); }); else b.onclick=async()=>{ if(await othSet(o.id,{locked:true})) othPoll(); };
        act.appendChild(b);
      } }
    else if(o.kind==='thermostat'){
      sub.textContent='Now '+fmtT(s.temp,s.unit)+(s.action&&s.action!=='idle'&&s.action!=='off'?' · '+s.action:'')+(s.mode==='off'?' · off':''); c.dataset.on=s.mode&&s.mode!=='off'?'1':'0';
      const st=el('div','ostep'); const dn=el('button','btn','−'), up=el('button','btn','+'), val=el('b',null,s.target==null?'—':fmtT(s.target,s.unit)); dn.type=up.type='button'; dn.setAttribute('aria-label','Lower target'); up.setAttribute('aria-label','Raise target');
      const step=async d=>{ if(s.target==null) return; const t=Math.max(s.min,Math.min(s.max,Math.round((s.target+d*(s.step||.5))*10)/10)); if(t===s.target) return; s.target=t; val.textContent=fmtT(t,s.unit); clearTimeout(step.t); step.t=setTimeout(async()=>{ if(await othSet(o.id,{target:t})) othPoll(); },700); };
      dn.onclick=()=>step(-1); up.onclick=()=>step(1); st.append(dn,val,up); act.appendChild(st);
      if((s.modes||[]).length>1){ const sel=el('select'); sel.setAttribute('aria-label','Mode for '+o.name); s.modes.forEach(m=>{ const op=el('option',null,m.replace(/_/g,' ')); op.value=m; sel.appendChild(op); }); sel.value=s.mode; sel.onchange=async()=>{ if(await othSet(o.id,{mode:sel.value})) othPoll(); }; act.appendChild(sel); }
    }
    c.appendChild(sub); c.appendChild(act); return c;
  }
  let finding=false;
  function drawOthers(){
    const host=$('othList'); if(!host) return; host.innerHTML='';
    $('ocount').textContent=others.length?'('+others.length+')':'';
    others.forEach(o=>host.appendChild(card(o)));
    $('othEmpty').hidden=others.length>0||finding;
    $('othBox').dataset.n=String(others.length);
  }
  async function find(){
    const panel=$('othFind'), msg=$('othMsg'); panel.innerHTML=''; msg.textContent='Looking…'; finding=true;
    let list;
    if(REMOTE){ const r=await srvApi('GET','/api/others/discover'); if(!r.ok){ msg.textContent=say(r); finding=false; return; } list=r.json.others||[]; }
    else list=Object.values(DEMO);
    const have=new Set(others.map(o=>o.id)); list=list.filter(x=>!have.has(x.id));
    msg.textContent=list.length?'Choose what to add.':(REMOTE?'Nothing new found. Plugs, door and motion sensors, thermostats and locks that Home Assistant has will show up here.':'Nothing new to add.');
    const picks=[];
    list.forEach(x=>{ const l=el('label','ofind'); const cb=el('input'); cb.type='checkbox'; cb.onchange=()=>{ if(cb.checked) picks.push(x); else picks.splice(picks.indexOf(x),1); add.disabled=!picks.length; }; l.appendChild(cb); l.appendChild(el('span',null,x.name)); l.appendChild(el('em',null,KIND[x.kind]||x.kind)); panel.appendChild(l); });
    const add=el('button','btn primary','Add selected'); add.type='button'; add.disabled=true;
    add.onclick=()=>{ picks.forEach(x=>{ if(others.length<40&&!others.some(o=>o.id===x.id)) others.push({id:x.id,name:x.name,kind:x.kind}); }); saveOthers(); panel.innerHTML=''; msg.textContent=''; finding=false; othPoll(); drawOthers(); };
    if(list.length){ const row=el('div','nrow'); row.appendChild(add); const cancel=el('button','btn','Cancel'); cancel.type='button'; cancel.onclick=()=>{ panel.innerHTML=''; msg.textContent=''; finding=false; drawOthers(); }; row.appendChild(cancel); panel.appendChild(row); }
    else finding=false;
  }
  function buildOthers(){
    const lights=$('lights'); if(!lights||$('othBox')) return;
    const box=el('div'); box.id='othBox';
    const h=el('h2',null,'Other devices '); const cnt=el('span','sub'); cnt.id='ocount'; h.appendChild(cnt); box.appendChild(h);
    const list=el('div','list others'); list.id='othList'; box.appendChild(list);
    const empty=el('p','note','No other devices yet. Add plugs, door and motion sensors, thermostats and locks that Home Assistant already knows about.'); empty.id='othEmpty'; box.appendChild(empty);
    if(ROLE!=='guest'){ const row=el('div','nrow'); const b=el('button','btn','Find devices'); b.type='button'; b.id='othFindBtn'; b.onclick=find; row.appendChild(b); const m=el('span','sub'); m.id='othMsg'; m.setAttribute('role','status'); row.appendChild(m); box.appendChild(row); const f=el('div','ofinds'); f.id='othFind'; box.appendChild(f); }
    else { const m=el('span','sub'); m.id='othMsg'; box.appendChild(m); const f=el('div'); f.id='othFind'; box.appendChild(f); }
    const anchor=$('empty'); anchor.parentNode.insertBefore(box,anchor.nextSibling);
    drawOthers();
  }
  /* ---------- history box in Activity ---------- */
  function buildHist(){
    const sec=document.querySelector('section[data-tab="Activity"]'); if(!sec||$('histBox')||ROLE==='guest') return;
    const box=el('div'); box.id='histBox'; const h2=sec.querySelector('h2');
    const hd=el('div','histhead'); hd.appendChild(el('h2',null,'Usage history'));
    const seg=el('div','seg'); [7,14,30].forEach(n=>{ const b=el('button','btn',n+' days'); b.type='button'; b.setAttribute('aria-pressed',String(n===histDays)); b.onclick=()=>{ histDays=n; seg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); renderHist(); }; seg.appendChild(b); });
    hd.appendChild(seg);
    const tools=el('div','histtools');
    const mk=(lbl,key,def,min,max,step)=>{ const l=el('label','htool'); l.appendChild(el('span',null,lbl)); const i=el('input','in'); i.type='number'; i.min=min; i.max=max; i.step=step; i.value=settings[key]!=null&&settings[key]!==''?settings[key]:def; i.onchange=()=>{ const v=parseFloat(i.value); if(isFinite(v)&&v>=min&&v<=max){ settings[key]=v; saveSettings(); renderHist(); } }; l.appendChild(i); return l; };
    tools.appendChild(mk('Watts per light','lightWatts',9,1,200,1)); tools.appendChild(mk('$ per kWh','kwhPrice',0.19,0,5,0.01));
    const csv=el('button','btn','Download CSV'); csv.type='button'; csv.onclick=exportCsv; tools.appendChild(csv);
    box.appendChild(hd); box.appendChild(tools); const out=el('div'); out.id='histOut'; box.appendChild(out);
    sec.insertBefore(box,h2); h2.textContent='Activity log';
    const o=new MutationObserver(()=>{ if(!sec.hidden) renderHist(); }); o.observe(sec,{attributes:true,attributeFilter:['hidden']});
  }
  /* ---------- sign-in: two-step code, forgot password ---------- */
  function loginViews(){
    const card=document.querySelector('#login .card'); if(!card||$('tfStep')) return;
    const mainEls=()=>document.querySelectorAll('#login .card>.seg,#login .card>.f,#login .card>.chk,#lGo,#lTv,#lForgot');
    const view=v=>{ mainEls().forEach(e=>e.classList.toggle('lvhide',v!=='main')); $('tfStep').hidden=v!=='tf'; $('rsStep').hidden=v!=='rs'; err(''); };
    window.__loginView=view;
    const forgot=el('button','btn linkish','Forgot password?'); forgot.type='button'; forgot.id='lForgot'; forgot.hidden=!SRV; $('lGo').after(forgot);
    const tf=el('div','lstep'); tf.id='tfStep'; tf.hidden=true;
    tf.innerHTML='<h3>Enter your code</h3><p class="sub">Open your authenticator app and type the 6-digit code for Lumora. You can also use one of your recovery codes.</p><label class="f">Code<input class="in" id="lCode" inputmode="numeric" autocomplete="one-time-code" maxlength="12"></label><button class="btn primary" id="lCodeGo" type="button">Verify</button> <button class="btn" id="lCodeBack" type="button">Back</button>';
    const rs=el('div','lstep'); rs.id='rsStep'; rs.hidden=true;
    rs.innerHTML='<h3>Reset your password</h3><p class="sub">Ask the person who runs Lumora (the admin) for a reset code. They make one in Settings, under Household. Enter your email above, then the code and a new password here.</p><label class="f">Reset code<input class="in" id="rsCode" autocomplete="off" maxlength="12" placeholder="ABCD-1234"></label><label class="f">New password<input class="in" id="rsPw" type="password" autocomplete="new-password"></label><button class="btn primary" id="rsGo" type="button">Set new password</button> <button class="btn" id="rsBack" type="button">Back</button>';
    card.insertBefore(tf,$('lGo')); card.insertBefore(rs,$('lGo'));
    let ticket='', keep=true;
    window.__ask2fa=(t,k)=>{ ticket=t; keep=k; view('tf'); $('lCode').value=''; $('lCode').focus(); };
    const verify=async()=>{ const r=await srvApi('POST','/api/login/2fa',{ticket,code:$('lCode').value}); if(r.ok) location.reload(); else{ err(say(r)); if(r.status===410) view('main'); } };
    $('lCodeGo').onclick=verify; $('lCode').addEventListener('keydown',e=>{ if(e.key==='Enter') verify(); });
    $('lCodeBack').onclick=()=>{ ticket=''; view('main'); };
    forgot.onclick=()=>{ view('rs'); $('lEmail').closest('.f').classList.remove('lvhide'); $('rsCode').focus(); };
    $('rsBack').onclick=()=>view('main');
    $('rsGo').onclick=async()=>{ const email=$('lEmail').value.trim().toLowerCase(); if(!/^\S+@\S+\.\S+$/.test(email)) return err('Enter your email address first.'); const r=await srvApi('POST','/api/reset',{email,code:$('rsCode').value,password:$('rsPw').value}); if(!r.ok) return err(say(r)); view('main'); $('rsCode').value=''; $('rsPw').value=''; $('lPw').value=''; err(''); $('gateNote').textContent='Password changed. Sign in with your new password.'; };
    const oldSet=setMode; setMode=function(m){ oldSet(m); forgot.hidden=!SRV||m!=='in'; };
  }
  /* ---------- Settings: two-step panel + household roles ---------- */
  function buildTwoStep(){
    if(!SRV||!SRV.user||$('tfBox')) return; const acct=$('pwSave')&&$('pwSave').closest('.panel'); if(!acct) return;
    const box=el('div'); box.id='tfBox'; box.appendChild(el('h4','gap','Two-step sign-in'));
    const msg=el('p','sub'); msg.id='tfMsg'; msg.setAttribute('role','status'); const body_=el('div'); box.append(body_,msg); acct.insertBefore(box,acct.lastElementChild);
    let on=!!SRV.user.twofa;
    const draw=()=>{
      body_.innerHTML=''; msg.textContent='';
      body_.appendChild(el('p','sub',on?'On. Signing in needs a code from your authenticator app after your password.':'Off. Add an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others) for a second check at sign-in.'));
      const pw=el('input','in'); pw.type='password'; pw.placeholder='Your password'; pw.setAttribute('aria-label','Your password'); pw.autocomplete='current-password';
      const code=el('input','in'); code.placeholder='Current code'; code.setAttribute('aria-label','Current code or recovery code'); code.inputMode='numeric'; code.maxLength=12;
      if(!on){ const b=el('button','btn','Turn on'); b.type='button'; const row=el('div','srow'); row.append(pw,b); body_.appendChild(row);
        b.onclick=async()=>{ const r=await srvApi('POST','/api/2fa/setup',{password:pw.value}); if(!r.ok){ msg.textContent=say(r); return; } setup(r.json); }; }
      else{ const b=el('button','btn danger','Turn off'); b.type='button'; const row=el('div','srow'); row.append(pw,code,b); body_.appendChild(row);
        b.onclick=async()=>{ const r=await srvApi('POST','/api/2fa/disable',{password:pw.value,code:code.value}); if(!r.ok){ msg.textContent=say(r); return; } on=false; draw(); msg.textContent='Two-step sign-in is off.'; }; }
    };
    const setup=j=>{
      body_.innerHTML='';
      body_.appendChild(el('p','sub','In your authenticator app choose “Enter a setup key” (or open the link on this phone) and add this key. Lumora can’t draw a QR code here, so the key is the way in.'));
      const k=el('div','tfkey',j.secret); body_.appendChild(k);
      const a=el('a',null,'Open in an authenticator app on this device'); a.href=j.uri; a.className='sub'; body_.appendChild(a);
      const code=el('input','in'); code.placeholder='6-digit code'; code.inputMode='numeric'; code.maxLength=7; code.setAttribute('aria-label','6-digit code from the app');
      const go=el('button','btn primary','Confirm and turn on'); go.type='button'; const row=el('div','srow'); row.append(code,go); body_.appendChild(row);
      go.onclick=async()=>{ const r=await srvApi('POST','/api/2fa/enable',{code:code.value}); if(!r.ok){ msg.textContent=say(r); return; } on=true; showCodes(r.json.recovery); };
    };
    const showCodes=list=>{
      body_.innerHTML=''; body_.appendChild(el('p','sub','Two-step sign-in is on. Save these recovery codes somewhere safe. Each one works once if you lose your phone. They won’t be shown again.'));
      const g=el('div','tfcodes'); list.forEach(c=>g.appendChild(el('code',null,c))); body_.appendChild(g);
      const cp=el('button','btn','Copy codes'); cp.type='button'; cp.onclick=async()=>{ try{ await navigator.clipboard.writeText(list.join('\n')); msg.textContent='Copied.'; }catch(e){ msg.textContent='Select the codes and copy them by hand.'; } };
      const dn=el('button','btn primary','I’ve saved them'); dn.type='button'; dn.onclick=draw; const row=el('div','srow'); row.append(cp,dn); body_.appendChild(row);
    };
    draw();
  }
  function buildRoleSelect(){
    const add=$('hhAdd'); if(!add||$('hhRole')) return;
    const row=el('div','srow stackrow'); const l=el('label',null,'Access'); l.htmlFor='hhRole'; const sel=el('select'); sel.id='hhRole';
    [['family','Family: lights, devices, automations'],['guest','Guest: lights and devices only'],['admin','Admin: everything']].forEach(([v,t])=>{ const o=el('option',null,t); o.value=v; sel.appendChild(o); });
    row.append(l,sel); add.closest('.srow').before(row);
    const note=el('p','sub','Money and phone numbers are admin-only. Tick “Money” on a family member to let them see it.'); add.closest('.srow').before(note);
  }
  function buildAll(){ buildOthers(); buildHist(); buildTwoStep(); buildRoleSelect(); applyRole(); loginViews(); }
  loginViews();
  /* Household list (called from the rewritten renderHH) */
  window.__hhRow=(u,refresh,msgEl)=>{
    const wrap=el('div','hhrow');
    const top=el('div','srow'); top.appendChild(el('span',null,u.name+' · '+u.email+(u.twofa?' · two-step on':''))); wrap.appendChild(top);
    const ctl=el('div','srow hhctl'); const me=u.email===SRV.user.email;
    const sel=el('select'); sel.setAttribute('aria-label','Access for '+u.name); [['admin','Admin'],['family','Family'],['guest','Guest']].forEach(([v,t])=>{ const o=el('option',null,t); o.value=v; sel.appendChild(o); }); sel.value=u.role; sel.disabled=me;
    sel.onchange=async()=>{ const r=await srvApi('PATCH','/api/admin/users/'+u.id,{role:sel.value}); msgEl.textContent=r.ok?u.name+' is now '+sel.value+'.':say(r); refresh(); };
    ctl.appendChild(sel);
    if(u.role==='family'){ const l=el('label','chk'); const cb=el('input'); cb.type='checkbox'; cb.checked=!!u.money; cb.onchange=async()=>{ const r=await srvApi('PATCH','/api/admin/users/'+u.id,{money:cb.checked}); msgEl.textContent=r.ok?(cb.checked?u.name+' can see Money.':u.name+' can no longer see Money.'):say(r); refresh(); }; l.append(cb,document.createTextNode('Money')); ctl.appendChild(l); }
    if(!me){
      const rs=el('button','btn','Reset password'); rs.type='button'; rs.onclick=async()=>{ const r=await srvApi('POST','/api/admin/users/'+u.id+'/reset'); msgEl.textContent=r.ok?'Reset code for '+u.name+': '+r.json.code+' (works for '+r.json.minutes+' minutes, once). Tell them to choose “Forgot password?” on the sign-in page.':say(r); }; ctl.appendChild(rs);
      if(u.twofa){ const t=el('button','btn','Turn off two-step'); t.type='button'; t.onclick=async()=>{ const r=await srvApi('POST','/api/admin/users/'+u.id+'/twofa-off'); msgEl.textContent=r.ok?'Two-step sign-in is off for '+u.name+'.':say(r); refresh(); }; ctl.appendChild(t); }
      const rm=el('button','btn danger','Remove'); rm.type='button'; rm.setAttribute('aria-label','Remove '+u.name); confirmBtn(rm,async()=>{ const d=await srvApi('DELETE','/api/admin/users/'+u.id); msgEl.textContent=d.ok?'Removed '+u.name+'.':say(d); refresh(); }); ctl.appendChild(rm);
    }
    wrap.appendChild(ctl); return wrap;
  };
  window.__buildOthersUI=buildAll;
  const kick=()=>{ buildAll(); othPoll(); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',kick); else kick();
  setInterval(()=>{ if(!document.hidden) othPoll(); },5000);
  if(REMOTE&&window.EventSource){ try{ const es=new EventSource('/api/events'); let t=0; es.addEventListener('other',()=>{ clearTimeout(t); t=setTimeout(othPoll,200); }); }catch(e){} }
})();


/* ---- status lamps: a floating side tab, like the warning lights on a car dashboard ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const I={bulb:'bulb',off:'bulboff',door:'door',lock:'lock',motion:'sensor',power:'boltoff',link:'link',away:'away',heat:'flame',batt:'battery',alert:'alert'};
  const LAMPS=[
    {k:'alarm',ic:'alert',c:'bad',l:'Smoke, gas or leak',go:'Devices'},
    {k:'power',ic:'power',c:'bad',l:'Power cut',go:'Activity'},
    {k:'offline',ic:'off',c:'bad',l:'Light offline',go:'Devices'},
    {k:'link',ic:'link',c:'bad',l:'Server link',inv:true,go:'Settings'},
    {k:'doors',ic:'door',c:'warn',l:'Door or window open',go:'Devices'},
    {k:'locks',ic:'lock',c:'warn',l:'Lock unlocked',go:'Devices'},
    {k:'batt',ic:'batt',c:'warn',l:'Camera battery low',go:'Devices'},
    {k:'lights',ic:'bulb',c:'amber',l:'Lights on',go:'Devices'},
    {k:'heat',ic:'heat',c:'amber',l:'Heating',go:'Devices'},
    {k:'motion',ic:'motion',c:'info',l:'Motion just now',go:'Activity'},
    {k:'away',ic:'away',c:'info',l:'Away mode',go:'Devices'}
  ];
  const tab=document.createElement('aside'); tab.id='sidetab'; tab.setAttribute('aria-label','Home status lights');
  tab.innerHTML='<button class="stgrip" type="button" aria-expanded="false" aria-label="Show home status lights"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button><div class="stlamps" role="list"></div>';
  document.body.appendChild(tab);
  const box=tab.querySelector('.stlamps'), grip=tab.querySelector('.stgrip');
  const els={};
  LAMPS.forEach(L=>{
    const b=document.createElement('button'); b.type='button'; b.className='tl'; b.dataset.k=L.k; b.dataset.c=L.c; b.setAttribute('role','listitem');
    b.innerHTML=ICO(I[L.ic])+'<span class="tll"><b>'+L.l+'</b><em></em></span>';
    b.onclick=()=>{ close(); try{ showTab(L.go); }catch(e){} };
    box.appendChild(b); els[L.k]=b;
  });
  const set=(k,on,txt)=>{ const b=els[k]; const was=b.dataset.on==='1'; b.dataset.on=on?'1':'0'; b.querySelector('em').textContent=txt; b.setAttribute('aria-label',LAMPS.find(x=>x.k===k).l+': '+txt); if(on&&!was) b.classList.add('flash'),setTimeout(()=>b.classList.remove('flash'),1200); };
  const plural=(n,a,b)=>n+' '+(n===1?a:b);
  function refresh(){
    try{
      const lt=state||[], on=lt.filter(d=>d.online!==false&&d.on).length, off=lt.filter(d=>d.online===false).length;
      const O=window.__othLive?window.__othLive():{others:[],live:{}}, ls=O.others.map(x=>O.live[x.id]).filter(Boolean);
      const doors=ls.filter(s=>s.kind==='sensor'&&s.active&&/^(door|window|garage_door|opening)$/.test(s.cls));
      const alarms=ls.filter(s=>s.kind==='sensor'&&s.active&&/^(smoke|gas|carbon_monoxide|moisture|safety)$/.test(s.cls));
      const motion=ls.filter(s=>s.kind==='sensor'&&s.active&&/^(motion|occupancy|presence)$/.test(s.cls));
      const unl=ls.filter(s=>s.kind==='lock'&&!s.locked);
      const heat=ls.filter(s=>s.kind==='thermostat'&&/heat/i.test(s.action||''));
      const camMotion=(cams||[]).filter(c=>c.last&&Date.now()-c.last<5*60000);
      const lowb=(cams||[]).filter(c=>typeof c.battery==='number'&&c.battery<=20);
      set('alarm',alarms.length>0,alarms.length?alarms.map(a=>a.name).join(', '):'All clear');
      set('power',!!(power&&power.outage),power&&power.outage?'Running without mains':'Normal');
      set('offline',off>0,off?plural(off,'light','lights')+' offline':'All reachable');
      const down=!!window.__devDown||(document.getElementById('netbar')&&document.getElementById('netbar').classList.contains('on')); set('link',down,down?'Can’t reach it':'Connected');
      set('doors',doors.length>0,doors.length?doors.map(a=>a.name).join(', '):'All closed');
      set('locks',unl.length>0,unl.length?unl.map(a=>a.name).join(', '):'All locked');
      set('batt',lowb.length>0,lowb.length?lowb.map(c=>c.name).join(', '):'Fine');
      set('lights',on>0,on?plural(on,'light','lights')+' on':'All off');
      set('heat',heat.length>0,heat.length?'Heating on':'Idle');
      set('motion',motion.length+camMotion.length>0,(motion.concat(camMotion)).map(a=>a.name).join(', ')||'Quiet');
      set('away',typeof presence!=='undefined'&&presence==='away',typeof presence!=='undefined'&&presence==='away'?'Nobody home':'Someone home');
      const bad=tab.querySelectorAll('.tl[data-on="1"][data-c="bad"]').length; tab.dataset.alert=bad?'1':'0'; tab.dataset.lit=tab.querySelector('.tl[data-on="1"]:not([data-k="link"])')?'1':'0';
    }catch(e){}
  }
  function open(){ tab.classList.add('open'); grip.setAttribute('aria-expanded','true'); grip.setAttribute('aria-label','Hide home status lights'); }
  function close(){ tab.classList.remove('open'); grip.setAttribute('aria-expanded','false'); grip.setAttribute('aria-label','Show home status lights'); }
  grip.onclick=()=>tab.classList.contains('open')?close():open();
  document.addEventListener('pointerdown',e=>{ if(tab.classList.contains('open')&&!tab.contains(e.target)) close(); },true);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
  refresh(); setInterval(refresh,1500);
  window.__refreshLamps=refresh;
})();


/* ---- automations that run on the server: client side ---- */
(function(){
  window.__srvAuto=r=>!!(REMOTE&&SRV&&SRV.config&&SRV.config.automations&&settings.serverAuto!==false&&(SRV.config.serverTypes||[]).includes(r.t.type));
  if(!REMOTE) return;
  const merge=async()=>{
    if(document.hidden||document.documentElement.dataset.popout==='1') return;
    const r=await srvApi('GET','/api/automations/log'); if(!r.ok||!Array.isArray(r.json.log)) return;
    const have=new Set(activity.map(a=>a.t+'|'+a.m)); let add=0;
    r.json.log.forEach(e=>{ if(!have.has(e.t+'|'+e.m)){ activity.push({t:e.t,m:e.m}); add++; } });
    if(!add) return; activity.sort((a,b)=>b.t-a.t); activity.length=Math.min(activity.length,100);
    try{ localStorage.setItem('hub-activity',JSON.stringify(activity)); }catch(e){} renderLog();
  };
  setInterval(merge,30000); setTimeout(merge,2500);
  if(window.EventSource){ try{ const es=new EventSource('/api/events'); let t=0; es.addEventListener('auto',()=>{ clearTimeout(t); t=setTimeout(()=>{ merge(); try{ renderRules(); }catch(e){} },800); }); }catch(e){} }
})();
