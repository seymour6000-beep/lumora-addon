
/* ---- Lumora 4.5: Christmas season (Dec 1 to Jan 5) ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const root=document.documentElement;
  const KEY='hub-seasonal';
  const qs=new URLSearchParams(location.search).get('season');
  /* an "off" you chose in one season only lasts for that season, so Christmas comes back every Dec 1 */
  const seasonYear=d=>d.getMonth()===0?d.getFullYear()-1:d.getFullYear();
  const pref=()=>{ try{ const v=localStorage.getItem(KEY)||'auto'; if(v==='off'){ const y=localStorage.getItem(KEY+'-yr'); if(y&&y!==String(seasonYear(new Date()))) return 'auto'; } return v; }catch(e){ return 'auto'; } };
  const inSeason=d=>{ const m=d.getMonth(), day=d.getDate(); return m===11||(m===0&&day<=5); };
  const isOn=()=>qs==='xmas'?true:qs==='off'?false:pref()==='off'?false:inSeason(new Date());
  /* festive scenes: always available, so rules can use them */
  try{ SCENES.Christmas={'*':{on:true,bri:60,color:'#ff4a3d'}}; SCENES['Christmas tree']={'*':{on:true,bri:55,color:'#3ddc84'}}; SCENES['Christmas gold']={'*':{on:true,bri:50,color:'#ffc65c'}}; }catch(e){}
  let flakes=null, cv=null, raf=0, garland=null;
  function snowOn(){
    if(cv||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv=document.createElement('canvas'); cv.id='xsnow'; cv.setAttribute('aria-hidden','true'); document.body.appendChild(cv);
    const c=cv.getContext('2d'); let w=0,h=0;
    const fit=()=>{ w=cv.width=innerWidth; h=cv.height=innerHeight; }; fit(); addEventListener('resize',fit);
    flakes=Array.from({length:70},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:1+Math.random()*2.6,v:.3+Math.random()*.9,d:Math.random()*6.28}));
    let last=0;
    const step=t=>{ raf=requestAnimationFrame(step); if(document.hidden||t-last<33) return; last=t; c.clearRect(0,0,w,h); c.fillStyle='rgba(255,255,255,.8)';
      for(const f of flakes){ f.y+=f.v; f.d+=.012; f.x+=Math.sin(f.d)*.4; if(f.y>h+5){ f.y=-5; f.x=Math.random()*w; } c.beginPath(); c.arc(f.x,f.y,f.r,0,6.283); c.fill(); } };
    raf=requestAnimationFrame(step);
  }
  function snowOff(){ if(raf) cancelAnimationFrame(raf); raf=0; if(cv){ cv.remove(); cv=null; } }
  function apply(){
    const on=isOn(); const was=root.dataset.season==='xmas';
    if(on){ root.dataset.season='xmas'; if(!garland){ garland=document.createElement('div'); garland.id='garland'; garland.setAttribute('aria-hidden','true'); garland.innerHTML=Array.from({length:40},(_,i)=>'<i style="--i:'+i+'"></i>').join(''); document.body.appendChild(garland); } snowOn(); }
    else { delete root.dataset.season; if(garland){ garland.remove(); garland=null; } snowOff(); }
    if(on!==was){ try{ window.__paintRoom&&window.__paintRoom(); }catch(e){} }
  }
  /* Christmas automations: added once per year, and switched off again after Jan 5. Delete them and they stay deleted. */
  function automations(){
    try{
      const d=new Date(), yr=d.getMonth()===0?d.getFullYear()-1:d.getFullYear();
      const done=localStorage.getItem('hub-xmas-set');
      if(inSeason(d)&&pref()!=='off'&&document.body.dataset.auth==='in'&&done!==String(yr)){
        const sun=hasLoc();
        const add=(id,name,t,acts)=>{ if(!rules.some(r=>r.id===id)) rules.push({id,on:true,name,t,c:[],acts,once:false,last:null,count:0}); };
        add('xmas-on','Christmas lights at sunset',sun?{type:'sun',which:'sunset',off:0}:{type:'time',at:'16:30',days:ALLDAYS},[{k:'scene',name:'Christmas'}]);
        add('xmas-tree','Switch to green at 8 pm',{type:'time',at:'20:00',days:ALLDAYS},[{k:'scene',name:'Christmas tree'}]);
        add('xmas-off','Christmas lights off at bedtime',{type:'time',at:'23:00',days:ALLDAYS},[{k:'scene',name:'All off'}]);
        saveRules(); try{ renderRules(); }catch(e){}
        localStorage.setItem('hub-xmas-set',String(yr)); try{ log('Christmas automations added'); }catch(e){}
      } else if(!inSeason(d)&&localStorage.getItem('hub-xmas-set')){
        let n=0; rules.forEach(r=>{ if(/^xmas-/.test(r.id)&&r.on){ r.on=false; n++; } });
        if(n){ saveRules(); try{ renderRules(); }catch(e){} }
        localStorage.removeItem('hub-xmas-set');
      }
    }catch(e){}
  }
  window.__xmas={isOn,apply,automations,toggle:()=>{ try{ const off=isOn(); localStorage.setItem(KEY,off?'off':'on'); localStorage.setItem(KEY+'-yr',String(seasonYear(new Date()))); }catch(e){} apply(); }};
  apply(); setInterval(()=>{ apply(); automations(); },60000);
  new MutationObserver(()=>automations()).observe(document.body,{attributes:true,attributeFilter:['data-auth']});
  setTimeout(automations,1500);
})();
