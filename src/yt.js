
/* ---- 8.4: YouTube upload alerts (bottom-left, stay until X, double beep once) ---- */
(function(){
  const K='hub-yt', DEF=[{h:'Autoauctionrebuilds'},{h:'conflictnerd'}], q=id=>document.getElementById(id);
  let S=null; try{ S=JSON.parse(localStorage.getItem(K)||'null'); }catch(e){}
  S=Object.assign({on:true,sound:true,channels:DEF.map(c=>({...c})),seen:[],pending:[]},S||{});
  if(!Array.isArray(S.channels)) S.channels=DEF.map(c=>({...c}));
  const save=()=>{ try{ localStorage.setItem(K,JSON.stringify(S)); }catch(e){} };
  const ID=/^[\w-]{11}$/, HANDLE=/^[A-Za-z0-9._-]{1,60}$/;
  let ctx=null, last=0;
  const unlock=()=>{ try{ if(!ctx){ const C=window.AudioContext||window.webkitAudioContext; if(C) ctx=new C(); } if(ctx&&ctx.state==='suspended') ctx.resume(); }catch(e){} };
  ['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,unlock,{passive:true}));
  /* two short beeps, played once per arrival */
  function dbl(){
    if(!S.sound) return false;
    try{ if(typeof soundOn!=='undefined'&&!soundOn) return false; }catch(e){}
    try{
      unlock(); if(!ctx) return false;
      let v=70; try{ if(typeof settings!=='undefined'&&settings.volume!=null) v=settings.volume; }catch(e){}
      const vol=Math.max(.0002,.22*v/100);
      [0,.22].forEach(d=>{ const t=ctx.currentTime+.03+d, o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=988; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+.15); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+.17); });
      window.__ytBeeps=(window.__ytBeeps||0)+1; return true;
    }catch(e){ return false; }
  }
  const stack=document.createElement('div'); stack.id='ytStack'; stack.setAttribute('aria-live','polite'); stack.setAttribute('aria-label','New YouTube videos'); document.body.appendChild(stack);
  function render(){
    stack.textContent='';
    S.pending.forEach(it=>{
      const c=document.createElement('div'); c.className='ytn'; c.setAttribute('role','status');
      const th=document.createElement(it.id&&ID.test(it.id)?'a':'div'); th.className='ytth';
      if(it.id&&ID.test(it.id)){ th.href='https://www.youtube.com/watch?v='+it.id; th.target='_blank'; th.rel='noopener noreferrer'; th.setAttribute('aria-label','Watch '+it.title); const im=document.createElement('img'); im.alt=''; im.loading='lazy'; im.onerror=()=>im.remove(); im.src='https://i.ytimg.com/vi/'+it.id+'/mqdefault.jpg'; th.appendChild(im); }
      else th.textContent='▶';
      const b=document.createElement('div'); b.className='ytb';
      const ch=document.createElement('span'); ch.className='ytch'; ch.textContent=it.ch||'YouTube';
      const t=document.createElement(it.id&&ID.test(it.id)?'a':'span'); t.className='ytt'; t.textContent=it.title||'New video';
      if(t.tagName==='A'){ t.href=th.href; t.target='_blank'; t.rel='noopener noreferrer'; }
      const w=document.createElement('span'); w.className='ytw'; w.textContent='New video today';
      b.append(ch,t,w);
      const x=document.createElement('button'); x.type='button'; x.className='ytx'; x.setAttribute('aria-label','Dismiss: '+(it.title||'new video')); x.textContent='✕';
      x.onclick=()=>{ S.pending=S.pending.filter(p=>p!==it&&!(p.id&&p.id===it.id&&p.at===it.at)); save(); render(); };
      c.append(th,b,x); stack.appendChild(c);
    });
  }
  const msg=t=>{ const m=q('ytMsg'); if(m) m.textContent=t||''; };
  async function check(manual,justAdded){
    last=Date.now();
    if(!S.on&&!manual) return 0;
    let ok=false; try{ ok=typeof SRV!=='undefined'&&!!SRV&&!!SRV.user; }catch(e){}
    if(!ok){ if(manual) msg('Checking YouTube needs the Lumora server. “Send a test” shows how a message looks.'); return 0; }
    const hs=S.channels.map(c=>c.h).filter(Boolean); if(!hs.length){ if(manual) msg('Add a channel first.'); return 0; }
    let r; try{ r=await srvApi('GET','/api/youtube?h='+encodeURIComponent(hs.join(','))); }catch(e){ r=null; }
    if(!r||!r.ok||!r.json){ if(manual) msg('Couldn’t reach YouTube just now. It will try again in a few minutes.'); return 0; }
    const today=new Date().toDateString(); let added=0, bad=[];
    (r.json.channels||[]).forEach(ch=>{
      if(!ch||!ch.videos){ if(ch&&ch.handle) bad.push(ch.handle); return; }
      const c=S.channels.find(x=>x.h===ch.handle); if(c&&ch.name) c.n=ch.name;
      ch.videos.forEach(v=>{
        if(!v||!ID.test(v.id)||isNaN(new Date(v.published))||new Date(v.published).toDateString()!==today||S.seen.includes(v.id)) return;
        S.seen.push(v.id); S.pending.push({id:v.id,ch:ch.name||ch.handle,title:String(v.title||'New video').slice(0,160),at:Date.now()}); added++;
      });
    });
    if(justAdded&&bad.some(h=>h===justAdded)){ S.channels=S.channels.filter(c=>c.h!==justAdded); bad=bad.filter(h=>h!==justAdded); msg('Couldn’t find @'+justAdded+' on YouTube, so it wasn’t added. Check the handle and try again.'); manual=false; }
    S.seen=S.seen.slice(-300); save(); render(); paintList();
    if(added) dbl();
    if(manual) msg(bad.length?('Couldn’t find: '+bad.join(', ')+'. Check the handle.'):added?(added===1?'1 new video today.':added+' new videos today.'):'No new videos today yet.');
    return added;
  }
  window.__ytCheck=check; window.__ytState=()=>S;
  function paintList(){
    const l=q('ytList'); if(!l) return; l.textContent='';
    S.channels.forEach(c=>{
      const row=document.createElement('div'); row.className='srow';
      const n=document.createElement('span'); n.className='ytnm'; const a=document.createElement('b'); a.textContent=c.n||c.h; const h=document.createElement('small'); h.textContent='@'+c.h; n.append(a,h);
      const b=document.createElement('button'); b.type='button'; b.className='btn'; b.textContent='Remove'; b.setAttribute('aria-label','Remove '+(c.n||c.h));
      b.onclick=()=>{ S.channels=S.channels.filter(x=>x!==c); save(); paintList(); };
      row.append(n,b); l.appendChild(row);
    });
    if(!S.channels.length){ const p=document.createElement('p'); p.className='sub'; p.textContent='No channels yet. Add one below.'; l.appendChild(p); }
    [['ytOn','on'],['ytSnd','sound']].forEach(([id,k])=>{ const s=q(id); if(s){ s.classList.toggle('on',!!S[k]); s.setAttribute('aria-checked',String(!!S[k])); } });
  }
  function bind(){
    if(!q('ytPanel')) return;
    [['ytOn','on'],['ytSnd','sound']].forEach(([id,k])=>{ const s=q(id); s.onclick=()=>{ S[k]=!S[k]; save(); paintList(); }; });
    q('ytAddBtn').onclick=()=>{
      let v=String(q('ytAdd').value||'').trim(); const m=v.match(/youtube\.com\/(?:@|channel\/)([\w.-]+)/i); if(m) v=m[1]; v=v.replace(/^@/,'');
      if(!HANDLE.test(v)){ msg('Type a channel handle such as conflictnerd.'); return; }
      if(S.channels.some(c=>c.h.toLowerCase()===v.toLowerCase())){ msg('That channel is already on the list.'); return; }
      if(S.channels.length>=8){ msg('You can follow up to 8 channels.'); return; }
      S.channels.push({h:v}); q('ytAdd').value=''; save(); paintList(); msg('Added @'+v+'. Checking now…'); check(true,v);
    };
    q('ytAdd').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); q('ytAddBtn').click(); } });
    q('ytTest').onclick=()=>{ S.pending.push({id:'',ch:'Test channel',title:'This is how a new video message looks',at:Date.now()}); save(); render(); dbl(); msg('Test message sent. Press ✕ on it to dismiss.'); };
    q('ytCheck').onclick=()=>check(true);
    paintList();
  }
  bind(); render();
  setInterval(()=>{ try{ if(document.body.dataset.auth==='in'&&Date.now()-last>=600000) check(false); }catch(e){} },30000);
})();
