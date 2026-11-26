
/* ---- Lumora 4.3: quick commands (Ctrl+K) ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const btn=document.createElement('button'); btn.id='cmdBtn'; btn.type='button'; btn.setAttribute('aria-label','Search and quick commands (Ctrl+K)'); btn.title='Search and quick commands (Ctrl+K)'; btn.innerHTML=ICO('search');
  document.body.appendChild(btn);
  const ov=document.createElement('div'); ov.id='cmdk'; ov.hidden=true; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','Quick commands');
  ov.innerHTML='<div class="cmdbox"><div class="cmdin">'+ICO('search')+'<input id="cmdq" type="text" placeholder="Type a light, scene, or page" autocomplete="off" spellcheck="false" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="cmdlist"><kbd>Esc</kbd></div><ul id="cmdlist" role="listbox"></ul><div class="cmdft"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> do it</span><span><kbd>Alt</kbd>+<kbd>1</kbd>–<kbd>8</kbd> pages</span></div></div>';
  document.body.appendChild(ov);
  const q=ov.querySelector('#cmdq'), list=ov.querySelector('#cmdlist'); let items=[], sel=0, lastFocus=null;
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function all(){
    const out=[]; const hasT=n=>{ try{ return !(n==='Money'&&document.body.dataset.money==='0')&&!(document.body.dataset.role==='guest'&&['Money','Automations','Activity'].includes(n)); }catch(e){ return true; } };
    TABS.filter(hasT).forEach((n,i)=>out.push({g:'Pages',ic:{Devices:'home',Automations:'bolt',Activity:'pulse',Clock:'clock',Sky:'sky',Money:'wallet',Apps:'apps',Settings:'sliders'}[n]||'home',t:'Go to '+n,k:n+' page tab go',run:()=>showTab(n)}));
    Object.keys(SCENES).forEach(n=>out.push({g:'Scenes',ic:/movie/i.test(n)?'movie':/evening/i.test(n)?'evening':/off/i.test(n)?'power':'sun',t:'Scene: '+n,k:'scene '+n,run:()=>doAct({k:'scene',name:n})}));
    out.push({g:'Lights',ic:'power',t:'Turn all lights off',k:'all lights off everything',run:()=>doAct({k:'scene',name:'All off'})});
    out.push({g:'Lights',ic:'bulb',t:'Turn all lights on (Bright)',k:'all lights on bright everything',run:()=>doAct({k:'scene',name:'Bright'})});
    state.filter(d=>d.online!==false).forEach(d=>out.push({g:'Lights',ic:d.on?'bulb':'bulboff',t:(d.on?'Turn off ':'Turn on ')+d.name,k:d.name+' light '+(d.room||'')+' toggle',sub:d.on?'On at '+d.bri+'%':'Off',run:()=>doAct({k:'light',id:d.id,op:'toggle'})}));
    try{ const O=window.__othLive(); O.others.forEach(o=>{ const s=O.live[o.id]; if(!s||s.online===false) return;
      if(o.kind==='plug') out.push({g:'Other devices',ic:'plug',t:(s.on?'Turn off ':'Turn on ')+o.name,k:o.name+' plug switch',run:()=>window.__othAction(o.id,{on:!s.on})});
      if(o.kind==='lock'&&s.locked===false&&document.body.dataset.role!=='guest') out.push({g:'Other devices',ic:'lock',t:'Lock '+o.name,k:o.name+' lock',run:()=>window.__othAction(o.id,{locked:true})}); }); }catch(e){}
    out.push({g:'App',ic:'search',t:'Open the Today panel',k:'today calendar notifications',run:()=>{ const b=document.getElementById('todayBtn'); if(b) b.click(); }});
    if(document.getElementById('popOutBtn')) out.push({g:'App',ic:'apps',t:'Pop out lights and notifications',k:'popout window',run:()=>document.getElementById('popOutBtn2').click()});
    if(window.__xmas) out.push({g:'App',ic:'star',t:(window.__xmas.isOn()?'Turn off the Christmas theme':'Turn on the Christmas theme'),k:'christmas holiday season snow theme',run:()=>window.__xmas.toggle()});
    return out;
  }
  const score=(it,s)=>{ if(!s) return 1; const hay=(it.t+' '+(it.k||'')).toLowerCase(); const words=s.toLowerCase().split(/\s+/).filter(Boolean); let sc=0; for(const w of words){ const i=hay.indexOf(w); if(i<0) return 0; sc+=i===0||hay[i-1]===' '?3:1; } return sc+ (it.t.toLowerCase().startsWith(s.toLowerCase())?3:0); };
  function draw(){
    const s=q.value.trim(); items=all().map(it=>({it,sc:score(it,s)})).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).map(x=>x.it).slice(0,40);
    if(!s){ const pri={Pages:0,Scenes:1,Lights:2,'Other devices':3,App:4}; items.sort((a,b)=>(pri[a.g]||0)-(pri[b.g]||0)); items=items.filter((x,i)=>true).slice(0,30); }
    sel=Math.min(sel,Math.max(0,items.length-1)); list.innerHTML='';
    if(!items.length){ list.innerHTML='<li class="cmdempty">Nothing matches “'+esc(s)+'”.</li>'; return; }
    let g=''; items.forEach((it,i)=>{ if(it.g!==g){ g=it.g; const h=document.createElement('li'); h.className='cmdg'; h.setAttribute('role','presentation'); h.textContent=g; list.appendChild(h); }
      const li=document.createElement('li'); li.className='cmdi'; li.setAttribute('role','option'); li.id='cmd'+i; li.setAttribute('aria-selected',String(i===sel)); li.innerHTML=ICO(it.ic||'bulb')+'<span>'+esc(it.t)+'</span>'+(it.sub?'<em>'+esc(it.sub)+'</em>':'');
      li.onmousemove=()=>{ if(sel!==i){ sel=i; mark(); } }; li.onclick=()=>pick(i); list.appendChild(li); });
    q.setAttribute('aria-activedescendant','cmd'+sel);
  }
  function mark(){ list.querySelectorAll('.cmdi').forEach((li,i)=>li.setAttribute('aria-selected',String(i===sel))); const cur=list.querySelector('.cmdi[aria-selected="true"]'); if(cur){ cur.scrollIntoView({block:'nearest'}); q.setAttribute('aria-activedescendant',cur.id); } }
  function open(){ if(!ov.hidden) return; lastFocus=document.activeElement; ov.hidden=false; document.body.classList.add('cmdopen'); q.value=''; sel=0; draw(); q.focus(); setTimeout(()=>q.focus(),30); }
  function close(){ if(ov.hidden) return; ov.hidden=true; document.body.classList.remove('cmdopen'); try{ if(lastFocus&&lastFocus.focus&&!document.body.dataset.noFocus) lastFocus.focus(); }catch(e){} }
  async function pick(i){ const it=items[i]; if(!it) return; close(); try{ await it.run(); }catch(e){ toast('That didn’t work. Try again.'); } }
  q.addEventListener('input',()=>{ sel=0; draw(); });
  q.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); sel=Math.min(items.length-1,sel+1); mark(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); sel=Math.max(0,sel-1); mark(); }
    else if(e.key==='Enter'){ e.preventDefault(); pick(sel); }
    else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    else if(e.key==='Tab'){ e.preventDefault(); }
  });
  ov.addEventListener('pointerdown',e=>{ if(e.target===ov) close(); });
  btn.onclick=open;
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); ov.hidden?open():close(); return; }
    if(e.altKey&&!e.ctrlKey&&!e.metaKey&&/^[1-9]$/.test(e.key)){ const n=TABS[+e.key-1]; if(n){ e.preventDefault(); showTab(n); } return; }
    if(e.key==='/'&&!/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||'')&&!document.activeElement.isContentEditable&&ov.hidden&&document.body.dataset.auth==='in'){ e.preventDefault(); open(); }
  },true);
})();
