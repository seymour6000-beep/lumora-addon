/* Lumora 6.2: more automation building blocks, a wait-between-runs setting and a Duplicate button */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const NEED=' (runs on the add-on)';
  Object.assign(TRIG,{
    interval:{l:'Every so often'+NEED,f:[{n:'every',t:'num',l:'Every (minutes)',d:60,min:1,max:1440}]},
    alarm:{l:'The alarm goes off'+NEED,f:[]},
    sleepstart:{l:'Sleep mode starts'+NEED,f:[]},
    sleepend:{l:'Sleep mode finishes'+NEED,f:[]}
  });
  Object.assign(COND,{
    weekday:{l:'It is one of these days',f:[{n:'days',t:'days',l:'Days'}]},
    anyon:{l:'Any light is on, or all are off',f:[{n:'v',t:'sel',l:'Right now',o:[['on','At least one light is on'],['off','Every light is off']],d:'on'}]},
    alarmmode:{l:'The alarm is armed or off',f:[{n:'v',t:'sel',l:'The alarm is',o:[['armed','Armed (Home or Away)'],['off','Off']],d:'armed'}]}
  });
  Object.assign(ACT,{
    sleep:{l:'Start sleep mode',f:[{n:'mins',t:'num',l:'Fade over (min, 0 = your usual)',d:0,min:0,max:120}]},
    media:{l:'Control the music',f:[{n:'op',t:'sel',l:'Do',o:[['pause','Pause'],['play','Play'],['next','Next track'],['previous','Previous track'],['volume_up','Volume up'],['volume_down','Volume down']],d:'pause'}]},
    alarm:{l:'Arm the alarm',f:[{n:'mode',t:'sel',l:'Arm it as',o:[['home','Home'],['away','Away']],d:'home'}]}
  });
  const MEDIAW={pause:'pause the music',play:'play the music',next:'skip to the next track',previous:'go back a track',volume_up:'turn the music up',volume_down:'turn the music down'};
  window.__autoText=(k,x)=>{
    switch(k){
      case 'interval': { const n=Math.round(+x.every)||60; return n%60===0?'every '+(n===60?'hour':n/60+' hours'):'every '+n+' min'; }
      case 'alarm': return 'the alarm goes off';
      case 'sleepstart': return 'sleep mode starts';
      case 'sleepend': return 'sleep mode finishes';
      case 'weekday': return 'today is '+(typeof dayList==='function'?dayList(x.days&&x.days.length?x.days:[0,1,2,3,4,5,6]):'a chosen day');
      case 'anyon': return x.v==='off'?'every light is off':'at least one light is on';
      case 'alarmmode': return x.v==='off'?'the alarm is off':'the alarm is armed';
      case 'sleep': return 'start sleep mode'+(+x.mins>0?' over '+x.mins+' min':'');
      case 'media': return MEDIAW[x.op]||'control the music';
      case 'alarm-act': return 'arm the alarm ('+(x.mode==='away'?'Away':'Home')+')';
    }
    return '';
  };
  /* client-side running (a rule started by hand or by a browser trigger) */
  window.__autoAct=async(a,ctx)=>{
    if(!(typeof REMOTE!=='undefined'&&REMOTE)){ log('“'+(a.k==='sleep'?'Start sleep mode':a.k==='media'?'Control the music':'Arm the alarm')+'” needs the add-on, so it was skipped'); return; }
    if(a.k==='sleep'){ const r=await srvApi('POST','/api/sleep/start',+a.mins>0?{minutes:+a.mins}:{}); if(!r.ok) log('Sleep mode could not start'); }
    else if(a.k==='alarm'){ if(a.mode==='home'||a.mode==='away') await srvApi('POST','/api/security/mode',{mode:a.mode}); }
    else if(a.k==='media'){
      const l=await srvApi('GET','/api/media'); const ps=(l.ok&&l.json&&l.json.players)||[]; const p=ps.find(x=>x.state==='playing')||ps.find(x=>x.spotify)||ps[0]; if(!p){ log('Music: no player found'); return; }
      if(a.op==='volume_up'||a.op==='volume_down') await srvApi('POST','/api/media',{id:p.id,action:'volume',value:Math.max(0,Math.min(100,(p.volume==null?30:p.volume)+(a.op==='volume_up'?10:-10)))});
      else await srvApi('POST','/api/media',{id:p.id,action:a.op,value:undefined});
    }
  };
  window.__autoCond=c=>{
    if(c.k==='weekday'){ const d=(Array.isArray(c.days)&&c.days.length?c.days:[0,1,2,3,4,5,6]); return d.includes(new Date().getDay()); }
    if(c.k==='anyon'){ const any=state.some(d=>d.on&&d.online!==false); return any===(c.v!=='off'); }
    if(c.k==='alarmmode'){ let m='off'; try{ m=(window.__secView&&window.__secView().mode)||'off'; }catch(e){} return c.v==='armed'?m!=='off':m==='off'; }
    return true;
  };
  /* ideas */
  const mk=(n,d,f)=>TPL.push({n,d,mk:f});
  mk('Alarm sounds: tell me','Shows a message with the time whenever the alarm goes off.',()=>({t:{type:'alarm'},acts:[{k:'notify',text:'The alarm went off at {time}.'}]}));
  mk('Arm the alarm at bedtime','Arms the alarm in Home mode at 11:00 PM every night.',()=>({t:{type:'time',at:'23:00',days:ALLDAYS},acts:[{k:'alarm',mode:'home'}]}));
  mk('Arm the alarm when I leave','When you switch to “I’m away”, the alarm arms in Away mode.',()=>({t:{type:'away'},acts:[{k:'alarm',mode:'away'}]}));
  mk('Quiet the music at sleep time','When sleep mode starts, the music pauses.',()=>({t:{type:'sleepstart'},acts:[{k:'media',op:'pause'}]}));
  mk('Weekday morning music','Plays music at 7:30 AM on weekdays, only if every light is off.',()=>({t:{type:'time',at:'07:30',days:[1,2,3,4,5]},c:[{k:'anyon',v:'off'}],acts:[{k:'media',op:'play'}]}));
  mk('Stretch break','Every hour between 9:00 AM and 5:00 PM, shows a reminder to stand up.',()=>({t:{type:'interval',every:60},c:[{k:'between',from:'09:00',to:'17:00'},{k:'weekday',days:[1,2,3,4,5]}],acts:[{k:'notify',text:'Time to stand up and stretch.'}]}));
  mk('Name the light left on','When a light has been on for 3 hours, tells you which one and turns it off.',()=>state.length&&{t:{type:'lefton',mins:180},acts:[{k:'notify',text:'{light} was left on. Turning it off.'},{k:'light',id:'@trigger',op:'off',mins:0}]});
  /* duplicate */
  function addDup(){
    const root=document.getElementById('rules'); if(!root||typeof rules==='undefined') return;
    [...root.querySelectorAll('.rule')].forEach((card,i)=>{
      const r=rules[i]; const tools=card.querySelector('.rtools'); if(!r||!tools||tools.querySelector('.rdup')) return;
      const b=document.createElement('button'); b.type='button'; b.className='chip rdup'; b.textContent='Duplicate'; b.title='Make a switched-off copy you can change';
      b.onclick=()=>{
        if(rules.length>=60){ toast('You can have up to 60 automations.'); return; }
        const c=JSON.parse(JSON.stringify(r)); c.id='r'+Date.now()+'-'+rules.length; c.name=((r.name||ruleTitle(r)).slice(0,32)+' (copy)'); c.on=false; c.last=null; c.count=0;
        rules.splice(i+1,0,c); saveRules(); renderRules(); log('Automation copied: '+ruleTitle(r)); toast('Copied. It is switched off until you turn it on.');
      };
      tools.append(b);
    });
  }
  const _r7=renderRules; renderRules=function(){ _r7.apply(this,arguments); try{ addDup(); }catch(e){} };
  try{ addDup(); }catch(e){}
})();
