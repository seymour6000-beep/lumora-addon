/* 8.1: group the long pages into side-by-side panes (moves existing nodes, nothing is recreated) */
(function(){
  const q=t=>document.querySelector('section[data-tab="'+t+'"]');
  function pane(nodes,cls){ if(!nodes.length) return; const d=document.createElement('div'); d.className='pane '+cls; nodes[0].before(d); nodes.forEach(n=>d.appendChild(n)); }
  function split(sec,cuts){ const k=[...sec.children]; const idx=cuts.map(c=>k.indexOf(c)); if(idx.some(i=>i<0)) return false; let from=0; idx.forEach((i,n)=>{ pane(k.slice(from,i+1),'p'+(n+1)); from=i+1; }); pane(k.slice(from),'p'+(idx.length+1)); sec.dataset.l8='1'; return true; }
  const A=q('Automations'); if(A&&!A.dataset.l8) split(A,[A.querySelector('#rules'),A.querySelector('.panel.builder')]);
  const P=q('Apps'); if(P&&!P.dataset.l8) split(P,[P.querySelector('.auto.add')]);
  const D=document.querySelector('.devmain'); if(D&&!D.dataset.l8){ const L=D.querySelector('#lights'), C=D.querySelector('#cams'), T=D.querySelector('.toolbar'); if(L&&C&&T){ const k=[...D.children]; const iT=k.indexOf(T), iL=k.indexOf(L), iC=k.indexOf(C); const left=k.slice(iT+1,iL+2), right=k.slice(iL+2); const wrap=document.createElement('div'); wrap.className='devcols'; T.after(wrap); const a=document.createElement('div'),b=document.createElement('div'); a.className='pane pl'; b.className='pane pc'; left.forEach(n=>a.appendChild(n)); right.forEach(n=>b.appendChild(n)); wrap.append(a,b); D.dataset.l8='1'; } }
})();
