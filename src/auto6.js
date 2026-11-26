
/* ---- Lumora 6, part 2: automations as flows, with a check button, run history and a live plain-words preview ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const el=(t,c,x)=>{ const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; };
  const openH=new Set(), openC=new Set();
  const trigIc=t=>({time:'clock',sun:'sun',motion:'camera',nomotion:'camera',lefton:'bulb',lightoff:'bulboff',manual:'power',home:'user',away:'away',sensor:'sensor',lockev:'lock',temp:'thermo',lowbat:'battery',outage:'boltoff',restored:'bolt',interval:'clock',alarm:'shield',sleepstart:'moon',sleepend:'moon'})[t]||'bolt';
  const actIc=k=>({light:'bulb',bri:'bulb',color:'bulb',scene:'evening',room:'home',fadeup:'sun',fadedown:'movie',notify:'bell',wait:'clock',plug:'plug',therm:'thermo',lock:'lock',sleep:'moon',media:'music',alarm:'shield'})[k]||'bolt';
  const chip=(ic,text,cls)=>{ const c=el('span','fchip'+(cls?' '+cls:'')); c.innerHTML=ICO(ic); c.append(el('span','',text)); return c; };
  const arrow=()=>{ const a=el('span','farrow'); a.setAttribute('aria-hidden','true'); a.innerHTML=ICO('chev'); return a; };
  function explain(r){
    const out=[];
    if(!r.on) out.push(['bad','This automation is switched off.']);
    if(settings.pauseAll) out.push(['bad','All automations are paused in the Automations page.']);
    if(typeof power!=='undefined'&&power.outage&&settings.powerPause&&r.t.type!=='outage'&&r.t.type!=='restored') out.push(['bad','Paused because the power is out.']);
    r.c.forEach(c=>{ let ok=false; try{ ok=condOK(c); }catch(e){} out.push([ok?'ok':'bad',(ok?'True now: ':'Not true now: ')+condText(c)]); });
    const blocked=out.some(o=>o[0]==='bad');
    out.push([blocked?'warn':'ok',blocked?'It would not run right now. When the trigger happens (when '+trigText(r.t)+'), it would be skipped.':'It would run when '+trigText(r.t)+'.']);
    out.push(['info','Then it would '+r.acts.map(actText).join(', then ')+'.']);
    return out;
  }
  function history(r){
    const t=ruleTitle(r); const a=(typeof activity!=='undefined'?activity:[]).filter(x=>x.m&&x.m.includes(t)).slice(0,6);
    return a;
  }
  function enhance(){
    const root=document.getElementById('rules'); if(!root||typeof rules==='undefined') return;
    const cards=[...root.querySelectorAll('.rule')];
    cards.forEach((card,i)=>{
      const r=rules[i]; if(!r||card.dataset.flow) return; card.dataset.flow='1';
      const txt=card.querySelector('.txt'); if(!txt) return;
      [...txt.querySelectorAll('.sub')].forEach(s=>{ if(/^Then /.test(s.textContent)) s.classList.add('thenline'); });
      const flow=el('div','rflow'); flow.setAttribute('aria-hidden','true');
      flow.append(chip(trigIc(r.t.type),cap(trigText(r.t)),'ft'));
      r.c.forEach(c=>{ flow.append(arrow(),chip('shield','Only if '+condText(c),'fc')); });
      r.acts.forEach(a=>{ flow.append(arrow(),chip(actIc(a.k),cap(actText(a)),'fa')); });
      txt.append(flow);
      const tools=el('div','rtools');
      const bc=el('button','chip','Check now'); bc.type='button'; bc.setAttribute('aria-expanded',String(openC.has(r.id))); bc.title='See what would happen right now, without running it';
      const bh=el('button','chip','History'); bh.type='button'; bh.setAttribute('aria-expanded',String(openH.has(r.id)));
      tools.append(bc,bh); txt.append(tools);
      const pc=el('div','rcheck'); pc.hidden=!openC.has(r.id); const ph=el('div','rhist'); ph.hidden=!openH.has(r.id);
      const fillC=()=>{ pc.replaceChildren(...explain(r).map(([k,m])=>el('div','rl '+k,m))); };
      const fillH=()=>{ const h=history(r); ph.replaceChildren(...(h.length?h.map(x=>el('div','rl info',new Date(x.t).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' · '+x.m)):[el('div','rl info','Nothing recorded yet. Runs and skips show here.')])); };
      fillC(); fillH();
      bc.onclick=()=>{ if(openC.has(r.id)) openC.delete(r.id); else { openC.add(r.id); fillC(); } pc.hidden=!openC.has(r.id); bc.setAttribute('aria-expanded',String(openC.has(r.id))); };
      bh.onclick=()=>{ if(openH.has(r.id)) openH.delete(r.id); else { openH.add(r.id); fillH(); } ph.hidden=!openH.has(r.id); bh.setAttribute('aria-expanded',String(openH.has(r.id))); };
      txt.append(pc,ph);
    });
    /* summary line */
    let sum=document.getElementById('rsum'); if(!sum){ sum=el('p','rsum'); sum.id='rsum'; root.parentNode.insertBefore(sum,root); }
    const day0=new Date(); day0.setHours(0,0,0,0); const ranToday=(typeof activity!=='undefined'?activity:[]).filter(a=>a.t>=day0&&/^Automation ran:/.test(a.m)).length;
    sum.textContent=rules.length?(rules.length+(rules.length===1?' automation':' automations')+' · '+rules.filter(r=>r.on).length+' on · '+ranToday+(ranToday===1?' run':' runs')+' today'):'';
  }
  const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);
  const _rr=renderRules; renderRules=function(){ _rr.apply(this,arguments); try{ enhance(); }catch(e){} };
  try{ enhance(); }catch(e){}
  /* plain-words preview under the builder */
  function prev(){
    const save=document.getElementById('bSave'); if(!save||typeof B==='undefined') return;
    let p=document.getElementById('bPrev'); if(!p){ p=el('p','bprev'); p.id='bPrev'; p.setAttribute('aria-live','polite'); const host=save.closest('.btns'); if(host) host.parentNode.insertBefore(p,host); }
    const safe=(f,d)=>{ try{ const v=f(); return v==null||/undefined|NaN/.test(String(v))?d:v; }catch(e){ return d; } };
    const tr=safe(()=>trigText(B.t),'the trigger happens'), cs=B.c.map(c=>safe(()=>condText(c),'a condition is true')), as=B.acts.map(a=>safe(()=>actText(a),'do a step'));
    const t='In plain words: when '+tr+(cs.length?', only if '+cs.join(' and '):'')+', '+(as.length?as.join(', then '):'(add at least one step below)')+'.';
    if(p.textContent!==t) p.textContent=t;
  }
  setInterval(()=>{ if(!document.hidden) prev(); },500);
})();
