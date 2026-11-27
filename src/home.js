
/* ---- Lumora 5.1: home screen (room cards and the live overview) ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const el=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; };
  const rgb=h=>{ const n=parseInt(String(h||'#fff1d6').slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; };
  /* room cards replace the plain room chips: the .rchip button still switches the whole room */
  window.renderRoomChips=function(){
    const box=document.getElementById('roomChips'); if(!box) return; box.innerHTML='';
    const rooms=[...new Set(state.map(d=>d.room||'Home'))].sort();
    if(rooms.length<2){ box.hidden=true; return; } box.hidden=false; box.classList.add('rcards');
    rooms.forEach(r=>{
      const all=state.filter(d=>(d.room||'Home')===r), ds=all.filter(d=>d.online!==false), on=ds.filter(d=>d.on), off=all.length-ds.length;
      const card=el('div','rcard'+(on.length?' lit':'')+(!ds.length?' dead':''));
      if(on.length){ const c=on.reduce((a,d)=>{ const v=rgb(d.color); return [a[0]+v[0],a[1]+v[1],a[2]+v[2]]; },[0,0,0]).map(x=>Math.round(x/on.length)); card.style.setProperty('--rc',c.join(',')); }
      const b=el('button','chip rchip'); b.type='button'; b.setAttribute('aria-pressed',String(on.length>0)); b.title='Switch every light in '+r;
      const ic=el('span','ri'); ic.innerHTML=ICO(on.length?'bulb':'bulboff'); const nm=el('span','rn',r);
      const ct=el('span','rc',!ds.length?'Offline':on.length+' of '+ds.length+' on'+(off?' · '+off+' offline':''));
      const avg=on.length?Math.round(on.reduce((a,d)=>a+(d.bri||0),0)/on.length):0; const bar=el('span','rb'); const fill=el('i'); fill.style.width=avg+'%'; bar.appendChild(fill); bar.setAttribute('aria-hidden','true');
      b.append(ic,nm,ct,bar); b.onclick=()=>roomToggle(r);
      const view=el('button','rshow','Show lights'); view.type='button'; view.setAttribute('aria-label','Show only the lights in '+r);
      view.onclick=()=>{ filters.room=filters.room===r?'':r; try{ renderRoomChips(); render(); renderCams(); }catch(e){} };
      view.textContent=filters.room===r?'Show all':'Show lights';
      card.append(b,view); box.appendChild(card);
    });
  };
  /* the overview strip under the hero */
  function tile(label,value,sub,tone){ const t=el('div','ovt'+(tone?' '+tone:'')); t.append(el('span','ovl',label),el('b','ovv',value),el('span','ovs',sub||'')); return t; }
  function overview(){
    let box=document.getElementById('ovStrip'); const hero=document.querySelector('section[data-tab="Devices"] .hero'); if(!hero) return;
    if(!box){ box=el('div','ovstrip'); box.id='ovStrip'; box.setAttribute('aria-label','Home at a glance'); hero.insertAdjacentElement('afterend',box); }
    if(typeof state==='undefined') return;
    const live=state.filter(d=>d.online!==false), on=live.filter(d=>d.on), off=state.length-live.length;
    const W=Math.max(1,Math.min(200,+settings.lightWatts||9)); const watts=on.reduce((a,d)=>a+W*Math.max(.1,(d.bri||100)/100),0);
    const cl=(typeof cams!=='undefined'?cams:[]), camsOn=cl.filter(c=>c.online!==false).length;
    const tiles=[tile('Lights on',on.length+' of '+state.length,off?off+' offline':'All reachable',off?'warn':'ok'), tile('Using now','≈ '+Math.round(watts)+' W',on.length?'Estimate from brightness':'Nothing is on'), tile('Mode',presence==='away'?'Away':'Home',presence==='away'?'Lights left on will be reported':'Welcome back')];
    const sig=JSON.stringify(tiles.map(t=>t.textContent)); if(box.dataset.sig===sig) return; box.dataset.sig=sig; box.replaceChildren(...tiles);
  }
  setInterval(()=>{ try{ overview(); }catch(e){} },1500); setTimeout(()=>{ try{ overview(); }catch(e){} },800);
})();
