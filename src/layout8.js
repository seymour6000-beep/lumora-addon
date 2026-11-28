/* 8.1: group the long pages into side-by-side panes (moves existing nodes, nothing is recreated) */
(function(){
  const q=t=>document.querySelector('section[data-tab="'+t+'"]');
  function pane(nodes,cls){ if(!nodes.length) return; const d=document.createElement('div'); d.className='pane '+cls; nodes[0].before(d); nodes.forEach(n=>d.appendChild(n)); }
  function split(sec,cuts){ const k=[...sec.children]; const idx=cuts.map(c=>k.indexOf(c)); if(idx.some(i=>i<0)) return false; let from=0; idx.forEach((i,n)=>{ pane(k.slice(from,i+1),'p'+(n+1)); from=i+1; }); pane(k.slice(from),'p'+(idx.length+1)); sec.dataset.l8='1'; return true; }
  const A=q('Automations'); if(A&&!A.dataset.l8) split(A,[A.querySelector('#rules'),A.querySelector('.panel.builder')]);
  const P=q('Apps'); if(P&&!P.dataset.l8) split(P,[P.querySelector('.auto.add')]);
  const D=document.querySelector('.devmain'); if(D&&!D.dataset.l8){ const L=D.querySelector('#lights'), C=D.querySelector('#cams'), T=D.querySelector('.toolbar'); if(L&&C&&T){ const k=[...D.children]; const iT=k.indexOf(T), iL=k.indexOf(L), iC=k.indexOf(C); const left=k.slice(iT+1,iL+2), right=k.slice(iL+2); const wrap=document.createElement('div'); wrap.className='devcols'; T.after(wrap); const a=document.createElement('div'),b=document.createElement('div'); a.className='pane pl'; b.className='pane pc'; left.forEach(n=>a.appendChild(n)); right.forEach(n=>b.appendChild(n)); wrap.append(a,b); D.dataset.l8='1'; } }
})();

/* 8.3.1: the bell opens a notifications dropdown; the Today panel becomes a small calendar dropdown */
(function(){
  const bell=document.getElementById('notifBtn'), nb=document.getElementById('noteBox'), tb=document.getElementById('todayBtn'); if(!bell||!nb) return;
  const m=document.createElement('div'); m.id='bellMenu'; m.hidden=true; m.setAttribute('role','dialog'); m.setAttribute('aria-label','Notifications');
  m.innerHTML='<div class="bmhead"><b>Notifications</b><span class="bmsw"><span>Pop-up alerts</span><button type="button" class="sw" role="switch" data-set="popups" aria-label="Pop-up alerts"><i></i></button></span></div><div class="bmbody"></div>';
  document.body.appendChild(m); m.querySelector('.bmbody').appendChild(nb);
  const pip=document.createElement('span'); pip.className='pip'; pip.id='bellPip'; pip.hidden=true; pip.setAttribute('aria-hidden','true'); bell.appendChild(pip);
  bell.setAttribute('aria-haspopup','dialog'); bell.setAttribute('aria-expanded','false'); bell.setAttribute('aria-label','Notifications');
  const setOpen=on=>{ m.hidden=!on; bell.setAttribute('aria-expanded',String(on)); if(on){ document.documentElement.classList.remove('today-open'); if(tb) tb.setAttribute('aria-expanded','false'); try{ bindSettings(); }catch(e){} } };
  bell.onclick=e=>{ e.stopPropagation(); setOpen(m.hidden); };
  m.querySelector('.sw').addEventListener('click',()=>setTimeout(()=>{ try{ syncNotif(); }catch(e){} },0));
  document.addEventListener('click',e=>{ if(!m.hidden&&!m.contains(e.target)&&!bell.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!m.hidden){ setOpen(false); bell.focus(); } });
  if(tb) tb.addEventListener('click',()=>{ if(!m.hidden) setOpen(false); },true);
  const paint=()=>{ const n=document.querySelectorAll('#noteList .nitem').length; pip.hidden=!n; bell.setAttribute('aria-label',n?'Notifications ('+n+')':'Notifications'); };
  setInterval(paint,1500); paint();
})();
