
/* ---- Lumora 6.1: music (Spotify through Home Assistant, plus any speaker it knows) ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const el=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; };
  const isRemote=()=>typeof REMOTE!=='undefined'&&REMOTE;
  let players=[], haOk=true, chosen='', busy=false, lastErr='';
  try{ chosen=localStorage.getItem('hub-musicpick')||''; }catch(e){}
  /* demo mode: a pretend Spotify player so you can try the controls */
  const TR=[['Golden Hour','Lumora Demo Band',212],['Porch Light','The Dimmers',187],['Warm White','Kelvin & Co',240]];
  let dm={id:'media_player.spotify_demo',name:'Spotify (demo)',state:'paused',spotify:true,title:TR[0][0],artist:TR[0][1],album:'Demo',volume:35,muted:false,source:'Kitchen speaker',sources:['Kitchen speaker','Living room','Phone'],shuffle:false,picture:'',duration:TR[0][2],position:0,_i:0,_t:Date.now()};
  const dmTick=()=>{ const now=Date.now(); if(dm.state==='playing'){ dm.position+= (now-dm._t)/1000; if(dm.position>=dm.duration){ dmSkip(1); } } dm._t=now; };
  function dmSkip(n){ dm._i=(dm._i+n+TR.length)%TR.length; const t=TR[dm._i]; dm.title=t[0]; dm.artist=t[1]; dm.duration=t[2]; dm.position=0; }
  async function pull(){
    if(!isRemote()){ dmTick(); players=[dm]; haOk=true; draw(); return; }
    const r=await srvApi('GET','/api/media'); if(!r.ok||!r.json) return; haOk=r.json.ha!==false; players=(r.json.players||[]).slice().sort((a,b)=>(b.spotify-a.spotify)||(b.state==='playing')-(a.state==='playing')||a.name.localeCompare(b.name)); draw();
  }
  const cur=()=>players.find(p=>p.id===chosen)||players.find(p=>p.state==='playing')||players[0]||null;
  async function act(action,value){
    const p=cur(); if(!p||busy) return; lastErr='';
    if(!isRemote()){ dmTick(); if(action==='toggle') dm.state=dm.state==='playing'?'paused':'playing'; else if(action==='next') dmSkip(1); else if(action==='previous') dmSkip(-1); else if(action==='volume') dm.volume=Number(value); else if(action==='shuffle') dm.shuffle=!!value; else if(action==='source') dm.source=value; else if(action==='play_media'){ dm.title='From your link'; dm.artist='Spotify'; dm.duration=200; dm.position=0; dm.state='playing'; } draw(); return; }
    busy=true; const r=await srvApi('POST','/api/media',{id:p.id,action,value}); busy=false;
    if(!r.ok) lastErr=(r.json&&r.json.error&&r.json.error.message)||(r.json&&r.json.message)||'That did not work.';
    setTimeout(pull,600); draw();
  }
  window.__musicPlayers=()=>players; window.__musicAct=act;
  const mmss=s=>{ s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
  function card(){
    let c=document.getElementById('musicCard'); if(c) return c;
    const a=document.getElementById('sleepCard')||document.getElementById('secCard')||document.getElementById('ovStrip'); if(!a) return null;
    c=el('section','musiccard'); c.id='musicCard'; c.setAttribute('aria-label','Music'); (document.getElementById('secCard')||a).insertAdjacentElement('afterend',c); return c;
  }
  function draw(){
    const c=card(); if(!c) return; const p=cur(); const keep=document.activeElement&&c.contains(document.activeElement)?document.activeElement.id:'';
    if(keep==='muLink'||keep==='muVol') return;   // do not redraw while someone is typing or dragging
    c.replaceChildren(); c.dataset.state=p?p.state:'none';
    const head=el('div','muhead'); const ic=el('span','muic'); ic.innerHTML=ICO('music'); const ht=el('div'); ht.append(el('h3','','Music'),el('p','sub',p?(p.spotify?'Spotify':'Speaker')+' · '+p.name:'No player found'));
    head.append(ic,ht);
    if(players.length>1){ const sel=el('select','musel'); sel.id='muPick'; sel.setAttribute('aria-label','Choose a player'); players.forEach(x=>{ const o=el('option','',x.name+(x.state==='playing'?' (playing)':'')); o.value=x.id; sel.appendChild(o); }); sel.value=p.id; sel.onchange=()=>{ chosen=sel.value; try{ localStorage.setItem('hub-musicpick',chosen); }catch(e){} draw(); }; head.appendChild(sel); }
    c.appendChild(head);
    if(!p){ const e=el('div','muempty'); e.append(el('p','',haOk?'Home Assistant has no music players yet.':'Music needs Home Assistant.'),el('p','sub','To use Spotify, add the Spotify integration in Home Assistant (Settings, Devices and services). Spotify Premium is needed to control playback. Open Settings in Lumora, then Connections and Spotify, for the steps.')); const b=el('button','btn sm','Open Spotify settings'); b.type='button'; b.onclick=()=>{ try{ localStorage.setItem('hub-setgroup','connections'); showTab('Settings'); }catch(e){} }; e.appendChild(b); c.appendChild(e); return; }
    const row=el('div','munow'); const art=el('div','muart'); if(p.picture){ const im=el('img'); im.src=p.picture; im.alt=''; im.referrerPolicy='no-referrer'; art.appendChild(im); } else art.innerHTML=ICO('music');
    const tx=el('div','mutx'); tx.append(el('b','mut',p.title||(p.state==='off'?'Off':'Nothing playing')),el('span','mua',[p.artist,p.album].filter(Boolean).join(' · ')||p.state));
    row.append(art,tx); c.appendChild(row);
    if(p.duration){ const pr=el('div','muprog'); const f=el('i'); f.style.width=Math.min(100,(p.position||0)/p.duration*100)+'%'; pr.appendChild(f); const tm=el('div','mutime'); tm.append(el('span','',mmss(p.position||0)),el('span','',mmss(p.duration))); c.append(pr,tm); }
    const ctl=el('div','mubtns'); const mk=(ic,lab,fn,cls)=>{ const b=el('button','mub'+(cls?' '+cls:'')); b.type='button'; b.setAttribute('aria-label',lab); b.innerHTML=ICO(ic); b.onclick=fn; return b; };
    const sh=mk('shuffle','Shuffle',()=>act('shuffle',!p.shuffle)); sh.setAttribute('aria-pressed',String(!!p.shuffle)); if(p.shuffle) sh.classList.add('on');
    ctl.append(sh,mk('skipprev','Previous track',()=>act('previous')),mk(p.state==='playing'?'pause':'play',p.state==='playing'?'Pause':'Play',()=>act('toggle'),'big'),mk('skipnext','Next track',()=>act('next')));
    c.appendChild(ctl);
    if(p.volume!=null){ const v=el('div','muvol'); const vi=el('span','muvi'); vi.innerHTML=ICO('volume'); const r=el('input'); r.type='range'; r.min=0; r.max=100; r.value=p.volume; r.id='muVol'; r.setAttribute('aria-label','Volume'); r.onchange=()=>act('volume',Number(r.value)); v.append(vi,r,el('span','muvn',p.volume+'%')); c.appendChild(v); }
    if(p.sources&&p.sources.length){ const s=el('div','srow'); const l=el('label','','Play on'); l.htmlFor='muSrc'; const sel=el('select'); sel.id='muSrc'; p.sources.forEach(x=>{ const o=el('option','',x); o.value=x; sel.appendChild(o); }); sel.value=p.source||p.sources[0]; sel.onchange=()=>act('source',sel.value); s.append(l,sel); c.appendChild(s); }
    const lk=el('div','mulink'); const inp=el('input','in'); inp.id='muLink'; inp.type='url'; inp.placeholder='Paste a Spotify playlist, album or song link'; inp.setAttribute('aria-label','Spotify link'); const go=el('button','btn sm','Play'); go.type='button'; go.onclick=()=>{ if(inp.value.trim()) act('play_media',inp.value.trim()); }; inp.onkeydown=e=>{ if(e.key==='Enter') go.click(); }; lk.append(inp,go); c.appendChild(lk);
    if(lastErr) { const e=el('p','muerr',lastErr); e.setAttribute('role','alert'); c.appendChild(e); }
  }
  function panel(){
    const grid=document.querySelector('section[data-tab="Settings"] .sgrid'); if(!grid) return null;
    let p=document.getElementById('spotPanel'); if(p) return p;
    p=el('div','panel wide'); p.id='spotPanel';
    p.innerHTML='<h3>Spotify</h3><p class="sub" id="spStat"></p><ol class="tvsteps"><li>In Home Assistant, open Settings, then Devices and services, then Add integration, and choose Spotify.</li><li>Sign in to Spotify when it asks. Playing music from Home Assistant needs Spotify Premium.</li><li>Open Spotify on a phone or speaker once so it shows up as a place to play.</li><li>Come back here. Spotify appears in the Music card on the Devices tab within a few seconds.</li></ol><p class="sub">Lumora never sees your Spotify password. Home Assistant holds the sign-in and Lumora only sends it play, pause, skip and volume.</p>';
    grid.appendChild(p); return p;
  }
  function stat(){
    const p=panel(); if(!p) return; const sp=players.filter(x=>x.spotify); const t=p.querySelector('#spStat');
    t.textContent=!isRemote()?'Demo mode: the Music card plays a pretend Spotify player. Connect Home Assistant to use the real one.':!haOk?'Lumora is not connected to Home Assistant.':sp.length?'Spotify found: '+sp.map(x=>x.name).join(', ')+'.':players.length?'Home Assistant has '+players.length+(players.length===1?' speaker':' speakers')+' but no Spotify yet.':'Spotify is not set up in Home Assistant yet.';
  }
  const boot=()=>{ card(); pull().then(stat); setInterval(()=>{ if(document.hidden) return; pull().then(stat); },isRemote()?4000:1000); };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',()=>setTimeout(boot,1100)); else setTimeout(boot,1100);
})();
