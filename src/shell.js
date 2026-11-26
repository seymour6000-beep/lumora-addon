
/* ---- Lumora 3 shell: Now hero, room light, Today drawer ---- */
(function(){
  const root=document.documentElement;
  const pad=n=>String(n).padStart(2,'0');
  function hero(){
    const d=new Date(), h=d.getHours(), m=d.getMinutes();
    const g=h<5?'Still up?':h<12?'Good morning':h<17?'Good afternoon':h<22?'Good evening':'Good night';
    const el=$('hClock'); if(!el) return;
    const t=settings.timeFormat==='24'?pad(h)+':'+pad(m):((h%12)||12)+':'+pad(m)+'<small>'+(h<12?'AM':'PM')+'</small>';
    if(el.dataset.k!==t){ el.dataset.k=t; el.innerHTML=t; }
    const dt=d.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'});
    if($('hDate').textContent!==dt) $('hDate').textContent=dt;
    const gr=$('greet'); const who=(typeof user!=='undefined'&&user&&user.name)?', '+String(user.name).split(' ')[0]:'';
    const gt=g+who; if(gr.textContent!==gt) gr.textContent=gt;
  }
  /* extra "at a glance" chips under the clock: weather, sun countdown, week/day, lights */
  /* Canadian (Nova Scotia) holidays, worked out here so no lookup is needed */
  function nthDow(y,m,dow,n){ const f=new Date(y,m,1).getDay(); return new Date(y,m,1+((dow-f+7)%7)+7*(n-1)); }
  function easter(y){ const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(y,mo-1,da); }
  function holidays(y){
    const E=easter(y), vic=new Date(y,4,24); while(vic.getDay()!==1) vic.setDate(vic.getDate()-1);
    return [['New Year’s Day',new Date(y,0,1)],['Heritage Day',nthDow(y,1,1,3)],['Valentine’s Day',new Date(y,1,14)],['Good Friday',new Date(+E-2*864e5)],['Easter Sunday',E],['Mother’s Day',nthDow(y,4,0,2)],['Victoria Day',vic],['Father’s Day',nthDow(y,5,0,3)],['Canada Day',new Date(y,6,1)],['Labour Day',nthDow(y,8,1,1)],['Truth and Reconciliation Day',new Date(y,8,30)],['Thanksgiving',nthDow(y,9,1,2)],['Halloween',new Date(y,9,31)],['Remembrance Day',new Date(y,10,11)],['Christmas Day',new Date(y,11,25)],['Boxing Day',new Date(y,11,26)]];
  }
  function nextHoliday(d){
    const t0=new Date(d.getFullYear(),d.getMonth(),d.getDate()); let best=null;
    [d.getFullYear(),d.getFullYear()+1].forEach(y=>holidays(y).forEach(([name,dt])=>{ const days=Math.round((dt-t0)/864e5); if(days>=0&&(!best||days<best.days)) best={name,days}; }));
    return best;
  }
  window.__nextHoliday=nextHoliday;
  const txt=id=>{ const e=$(id); return e?e.textContent.trim():''; };
  function chip(k,v){ return '<span class="hchip"><em>'+k+'</em>'+v+'</span>'; }
  function meta(d){
    const out=[];
    const t=txt('wxTemp'), c=txt('wxCond');
    if(t&&t!=='…'&&t!=='—') out.push(chip('Outside',t+(c&&c!=='Loading weather…'&&c!=='Weather unavailable'?' · '+c.split(' · ')[0]:'')));
    const nm=d.getHours()*60+d.getMinutes()+d.getSeconds()/60, s=(typeof sunMinutes==='function')?sunMinutes(d,true):null;
    let arc=null, arcL='';
    if(s&&!s.none){
      const f=m=>(typeof fmt==='function')?fmt(minToHM(m)):minToHM(m), dur=m=>{ m=Math.round(m); return Math.floor(m/60)+' h '+pad(m%60)+' min'; };
      if(nm<s.rise){ out.push(chip('Sunrise','in '+dur(s.rise-nm)+' · '+f(s.rise))); arc=0; arcL='Sunrise '+f(s.rise)+'  ·  Sunset '+f(s.set); }
      else if(nm<s.set){ out.push(chip('Sunset','in '+dur(s.set-nm)+' · '+f(s.set))); arc=(nm-s.rise)/(s.set-s.rise); arcL=dur(s.set-s.rise)+' of daylight today'; }
      else{ const tm=sunMinutes(new Date(d.getTime()+864e5),true); out.push(chip('Sunrise','tomorrow '+(tm&&!tm.none?f(tm.rise):'')));  arc=1; arcL='Sunset was '+f(s.set); }
    }
    const jan1=new Date(d.getFullYear(),0,1), doy=Math.floor((new Date(d.getFullYear(),d.getMonth(),d.getDate())-jan1)/864e5)+1;
    const wk=Math.ceil((doy+((jan1.getDay()+6)%7))/7);
    const hol=nextHoliday(d); if(hol) out.push(chip('Next holiday',hol.name+' · '+(hol.days===0?'today':hol.days===1?'tomorrow':'in '+hol.days+' days')));
    out.push(chip('Day',doy+' · week '+wk));
    const on=(typeof state!=='undefined'&&state)?state.filter(x=>x.online!==false&&x.on).length:0;
    out.push(chip('Lights',on?on+' on':'all off'));
    const m=$('hMeta'); const h=out.join(''); if(m&&m.dataset.k!==h){ m.dataset.k=h; m.innerHTML=h; }
    const fill=$('dayArcFill'), sun=$('dayArcSun'), al=$('dayArcL'), box=$('dayArc');
    if(box){ box.style.display=arc===null?'none':''; if(al) al.style.display=arc===null?'none':''; }
    if(arc!==null){ const p=(Math.max(0,Math.min(1,arc))*100).toFixed(1)+'%'; fill.style.width=p; sun.style.left=p; box.classList.toggle('night',arc===0||arc===1); if(al&&al.textContent!==arcL) al.textContent=arcL; }
  }
  const hero0=hero; hero=function(){ hero0(); try{ meta(new Date()); }catch(e){} };
  hero(); setInterval(hero,1000);

  /* the room takes on the colour of the lights that are on */
  const LIGHTTHEME=['daylight','porcelain'];
  function hex(c){ c=String(c||''); return /^#[0-9a-f]{6}$/i.test(c)?[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]:[255,200,120]; }
  let last='', lastOn=-1;
  window.__paintRoom=function(){
    const live=state.filter(d=>d.online!==false), on=live.filter(d=>d.on), off=state.length-live.length;
    const ranked=on.slice().sort((x,y)=>(y.bri||0)-(x.bri||0));
    const col=ranked.length?(/^#[0-9a-f]{6}$/i.test(ranked[0].color)?ranked[0].color:'#ffb35c'):'#ffb35c';
    const col2=ranked.length>1&&/^#[0-9a-f]{6}$/i.test(ranked[1].color)?ranked[1].color:col;
    const avg=ranked.length?ranked.reduce((t,d)=>t+(d.bri||50),0)/ranked.length:0;
    let o=on.length?Math.min(.62,.2+(avg/100)*.2+Math.min(on.length,8)*.03):0;
    if(LIGHTTHEME.includes(root.dataset.design)) o*=.45;
    root.style.setProperty('--pool2',col2);
    const key=col+'|'+col2+'|'+o.toFixed(2)+'|'+root.dataset.design;
    if(key!==last){ last=key; root.style.setProperty('--pool',col); root.style.setProperty('--pool-o',o.toFixed(2)); }
    const ring=$('ring'); if(!ring) return;
    const N=state.length||1, seg=360/N, gap=N>1?Math.min(7,seg*.18):0, stops=[];
    state.forEach((d,i)=>{ const c=(d.online!==false&&d.on)?(/^#[0-9a-f]{6}$/i.test(d.color)?d.color:'#ffb35c'):(d.online===false?'color-mix(in srgb,var(--bad) 55%,transparent)':'var(--off)'); const a0=i*seg+gap/2, a1=(i+1)*seg-gap/2; stops.push('transparent '+(i*seg)+'deg '+a0+'deg',c+' '+a0+'deg '+a1+'deg','transparent '+a1+'deg '+((i+1)*seg)+'deg'); });
    const rb='conic-gradient('+(state.length?stops.join(','):'var(--off) 0 360deg')+')'; if(ring.dataset.k!==rb){ ring.dataset.k=rb; ring.style.background=rb; }
    const n=$('ringN'); const txt=on.length+'<small>/'+state.length+'</small>';
    if(n.dataset.k!==txt){ n.dataset.k=txt; n.innerHTML=txt; if(lastOn>=0&&root.dataset.fx!=='off'){ n.classList.remove('flip'); void n.offsetWidth; n.classList.add('flip'); } lastOn=on.length; }
    $('ringL').textContent=!state.length?'No lights yet':off?(on.length===1?'light on':'lights on')+' · '+off+' offline':(on.length===1?'light on':'lights on');
    $('ringL').style.color=off?'var(--bad)':'';
    const pip=$('todayPip'); if(pip) pip.hidden=!document.querySelector('#noteListM .nitem');
  };
  if(typeof renderStats==='function'){ const _rs=renderStats; renderStats=function(){ const r=_rs.apply(this,arguments); try{ window.__paintRoom(); }catch(e){} return r; }; }
  setInterval(()=>{ try{ window.__paintRoom(); }catch(e){} },3000);
  new MutationObserver(()=>{ try{ window.__paintRoom(); }catch(e){} }).observe(root,{attributes:true,attributeFilter:['data-design']});

  /* Today drawer */
  const set=on=>{ root.classList.toggle('today-open',on); $('todayBtn').setAttribute('aria-expanded',String(on)); if(on) setTimeout(()=>{ const c=$('todayClose'); c&&c.focus(); },300); else $('todayBtn').focus&&0; };
  $('todayBtn').onclick=()=>set(!root.classList.contains('today-open'));
  $('todayScrim').onclick=()=>set(false);
  $('todayClose').onclick=()=>{ set(false); $('todayBtn').focus(); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&root.classList.contains('today-open')){ set(false); $('todayBtn').focus(); } });
  window.tvBackOld=window.tvBack;
})();


/* ---- buttons react where you press them: a ripple spreads from the click point and the button leans toward it ---- */
(function(){
  const SEL='button,.btn,.chip,.alloff,#tabs .tab,.vtag,[role="button"]';
  const SKIP='input,select,textarea,.sl,[type="range"],.bulb';
  document.addEventListener('pointerdown',e=>{
    if(e.button>0||e.pointerType==='') return;
    const b=e.target.closest&&e.target.closest(SEL); if(!b||b.disabled||b.matches(SKIP)) return;
    const root=document.documentElement;
    if(root.dataset.fx==='off'||root.dataset.motion==='reduced'||(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)) return;
    const r=b.getBoundingClientRect(); if(!r.width||!r.height) return;
    const x=e.clientX-r.left, y=e.clientY-r.top;
    /* lean: the button dips slightly toward the point you pressed */
    const nx=(x/r.width-.5)*2, ny=(y/r.height-.5)*2;
    b.style.setProperty('--ox',x+'px'); b.style.setProperty('--oy',y+'px');
    b.style.setProperty('--tx',(nx*2).toFixed(1)+'px'); b.style.setProperty('--ty',(ny*2).toFixed(1)+'px');
    b.style.setProperty('--rx',(-ny*5).toFixed(1)+'deg'); b.style.setProperty('--ry',(nx*5).toFixed(1)+'deg');
    b.classList.add('pressfx');
    const rel=()=>{ b.classList.remove('pressfx'); removeEventListener('pointerup',rel,true); removeEventListener('pointercancel',rel,true); };
    addEventListener('pointerup',rel,true); addEventListener('pointercancel',rel,true);
    /* ripple */
    const rp=document.createElement('span'); rp.className='ripple'; rp.setAttribute('aria-hidden','true');
    const d=Math.hypot(Math.max(x,r.width-x),Math.max(y,r.height-y))*2;
    rp.style.cssText='left:'+x+'px;top:'+y+'px;width:'+d+'px;height:'+d+'px';
    b.classList.add('hasripple'); b.appendChild(rp);
    setTimeout(()=>{ rp.remove(); if(!b.querySelector('.ripple')) b.classList.remove('hasripple'); },650);
  },true);
})();
