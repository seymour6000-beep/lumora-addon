import re,shutil,os
src='/tmp/v3/fresh.html'; out='/mnt/user-data/outputs/v3/home-hub-v3.html'
s=open(src).read()
def rep(a,b,cnt=1):
    global s
    assert a in s,a[:90]; s=s.replace(a,b,cnt)
css=open('/tmp/v3/new.css').read(); rob=open('/tmp/v3/rob.js').read(); shell=open('/tmp/v3/shell.js').read()
# 1 stylesheet
i=s.index('<style>'); j=s.index('</style>')
s=s[:i]+'<style>\n'+css+'\n'+s[j:]
rep('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500;700;800;900&family=Red+Hat+Text:wght@400;500;600&display=swap">','<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Unbounded:wght@400;500;600&display=swap">')
rep('data-design="fog"','data-design="nocturne"')
# early error capture
k=s.index('<script>')+len('<script>')
s=s[:k]+"\nwindow.__errs=[];addEventListener('error',function(e){var m=String(e.message||'');if(/ResizeObserver|Script error/i.test(m))return;window.__errs.push({t:Date.now(),m:m.slice(0,300),s:String(e.filename||'').split('/').pop()+':'+e.lineno});if(window.__errs.length>30)window.__errs.shift()});addEventListener('unhandledrejection',function(e){var r=e.reason;window.__errs.push({t:Date.now(),m:String(r&&r.message||r).slice(0,300),s:'promise'});if(window.__errs.length>30)window.__errs.shift()});\n"+s[k:]
# 2 shell markup
a=s.index('<div id="bgfx"'); b=s.index('<section data-tab="Devices">')
old=s[a:b]
topbar=old[old.index('<div class="topbar"'):old.index('<header>')]
newtop='''<div id="bgfx" aria-hidden="true"></div>
<div id="pool2" aria-hidden="true"></div><div id="pool" aria-hidden="true"></div>
<main>
'''+topbar
s=s[:a]+newtop+s[b:]
rep('<section data-tab="Devices">\n','''<section data-tab="Devices">
<div class="hero">
  <div class="nowcard">
    <button class="vtag herovtag" id="verTagM" type="button" aria-live="polite"></button>
    <p class="greet" id="greet">Hello</p>
    <h1 id="homeTitle">Home</h1>
    <p id="summary">Loading lights…</p>
    <div class="hclock" id="hClock" role="timer" aria-live="off"></div>
    <div class="hdate" id="hDate"></div>
    <div class="hmeta" id="hMeta" aria-label="Today at a glance"></div>
    <div class="dayarc" id="dayArc" aria-hidden="true"><i id="dayArcFill"></i><b id="dayArcSun"></b></div>
    <div class="dayarcl" id="dayArcL"></div>
  </div>
  <div class="statuscard">
    <div class="ring" id="ring" role="img" aria-label="Lights on"><b id="ringN">0<small>/0</small></b></div>
    <p class="ringl" id="ringL">lights on</p>
    <div class="sunrow" id="sunRowM" aria-label="Sunrise and sunset"></div>
  </div>
</div>
''')
rep('<div class="sunrow sunm" id="sunRowM" aria-label="Sunrise and sunset"></div>\n','')
nm='<div class="notes notem" id="noteBoxM" aria-label="Notifications"><h3 class="nh">Notifications</h3><div id="noteListM" aria-live="polite"></div></div>\n'
rep(nm,'')
rep('<div class="hero">\n',nm+'<div class="hero">\n')
rep('<div class="strip" id="scenes" role="group" aria-label="Scenes"></div>\n','')
rep('<div class="actbar" role="group" aria-label="Quick actions">\n','<div class="actbar" role="group" aria-label="Quick actions">\n  <div class="strip" id="scenes" role="group" aria-label="Scenes"></div>\n  <span class="vsep" aria-hidden="true"></span>\n')
rep('<aside class="today" id="today" aria-label="Today">','''<button id="todayBtn" type="button" aria-label="Today: calendar, notifications and account" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/></svg><span class="pip" id="todayPip" hidden></span></button>
<div class="scrim" id="todayScrim"></div>
<aside class="today" id="today" aria-label="Today">
  <button class="btn sm" id="todayClose" type="button" style="align-self:flex-end">Close</button>''')
rep('Show clock and calendar in the sidebar','Show the clock and calendar in the Today panel',2)
# netbar, rescue
rep('<div id="saver" aria-hidden="true">','''<div id="netbar" role="status" aria-live="polite"><i aria-hidden="true"></i><span>Can’t reach the Lumora server. Trying again…</span></div>
<div id="rescue" role="alertdialog" aria-modal="true" aria-labelledby="rescueT"><div class="rb"><h2 id="rescueT">Lumora didn’t start properly</h2><p class="sub">Something went wrong while loading. Nothing was lost. The last problem was:</p><p class="errlist" id="rescueMsg" style="max-height:none"></p><div class="srow"><button class="btn primary" id="rescueReload" type="button">Reload</button><button class="btn" id="rescueReset" type="button">Reset the display cache and reload</button><button class="btn" id="rescueHide" type="button">Keep looking</button></div></div></div>
<div id="saver" aria-hidden="true">''')
rep('<div class="panel wide" id="tvUse">','''<div class="panel wide" id="healthPanel"><h3>Health and backup</h3>
  <div id="healthRows"></div>
  <ul class="errlist" id="errList" hidden></ul>
  <div class="nrow"><button class="btn" id="hCopy" type="button">Copy a problem report</button><button class="btn" id="hClear" type="button">Clear problems</button></div>
  <h4 class="gap">Backup</h4>
  <p class="sub">Save your lights, automations, scenes, settings and money data to a file, or load one back. Use this before big changes or when moving to a new server.</p>
  <div class="nrow"><button class="btn" id="hBackup" type="button">Download a backup</button><button class="btn" id="hRestore" type="button">Restore from a backup</button><input id="hFile" type="file" accept="application/json,.json" hidden><span class="sub" id="hMsg" role="status"></span></div>
</div>
<div class="panel wide" id="tvUse">''')
rep('<div class="srow"><span>Reduce motion</span>','<div class="srow"><label for="sFx">Effects</label><select id="sFx" data-set="fxMode"><option value="auto">Automatic</option><option value="full">Full</option><option value="subtle">Subtle</option><option value="off">Off</option></select></div>\n  <p class="sub" id="sFxNote"></p>\n  <div class="srow"><span>Reduce motion</span>')
rep("tvMode:'auto',","tvMode:'auto',fxMode:'auto',")
# designs
rep("const DESIGNS=[['Fog','#1b5e57','#e6ebec'],['Gull','#d63a2a','#eceef0'],['Harbour','#ffc233','#0e1a21'],['Spruce','#8fe0b4','#0d1f1b'],['Twilight','#b9a4ff','#17142a']];","const DESIGNS=[['Nocturne','#8c9bff','#0a0912'],['Daylight','#4a3df0','#eceaf6'],['Ember','#ff8a4c','#110b09'],['Lagoon','#38e0c0','#041214'],['Porcelain','#0b8a5a','#e8f0ec'],['Mono','#ffffff','#000000']];")
rep("if(!DESIGNS.some(x=>x[0]===n)) n='Fog';","if(!DESIGNS.some(x=>x[0]===n)) n='Nocturne';")
rep("""let startDesign=(window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches)?'Harbour':'Fog';""","""let startDesign=(window.matchMedia&&matchMedia('(prefers-color-scheme:light)').matches)?'Daylight':'Nocturne';""")
# JS
rep("if(el.closest('[hidden]')||el.closest('.toasts')||el.closest('.legend')) return false;","if(el.closest('[hidden]')||el.closest('.toasts')||el.closest('.legend')) return false;\n    { const dt=el.closest('details'); if(dt&&!dt.open&&!el.closest('summary')) return false; }")
rep("  try{ window.__renderNotes&&window.__renderNotes(); }catch(e){}\n  const live=","  try{ window.__renderNotes&&window.__renderNotes(); }catch(e){}\n  const live=")
v=s.index("/* ---- 2.4: what's new"); others=open('/tmp/v3/others.js').read()+open('/tmp/v3/gfx.js').read()+open('/tmp/v3/palette.js').read()+open('/tmp/v3/xmas.js').read()+open('/tmp/v3/splash2.js').read()+open('/tmp/v3/watch.js').read()+open('/tmp/v3/voice.js').read()+open('/tmp/v3/home.js').read()+open('/tmp/v3/auto6.js').read()+open('/tmp/v3/auto7.js').read()+open('/tmp/v3/security.js').read()+open('/tmp/v3/offline.js').read()+open('/tmp/v3/bluetooth.js').read()+open('/tmp/v3/sleep.js').read()+open('/tmp/v3/music.js').read()+open('/tmp/v3/settings6.js').read()+open('/tmp/v3/fullscreen.js').read()+open('/tmp/v3/layout8.js').read()+open('/tmp/v3/yt.js').read(); s=s[:v]+rob+shell+others+s[v:]
rep("const APP_VERSION='2.5.2';","const APP_VERSION='3.2.2';")
rep("const RELEASE_NOTES={","const RELEASE_NOTES={\n  '3.2.2':{t:'Back to the usual size',items:['Wide-screen scaling is removed. Screens and layouts are sized the way they were in 3.1.0. The colour panel on a light has a Done button, and also closes with Esc or a click outside.']},\n  '3.2.0':{t:'Lumora 3.2',items:['Other devices: add smart plugs, door and motion sensors, thermostats and locks that Home Assistant already has. New automations such as “when the front door opens and it is dark, turn on the hallway”. Automations can lock a door but never unlock one.','Accounts with different access: admin, family and guest. Money and phone numbers are admin-only (an admin can allow Money for a family member). Guests only see lights and devices.','Two-step sign-in with an authenticator app, recovery codes, and a password reset code from the admin.','Usage history in Activity: hours each light was on, per day and per light, and a list of offline events with how long they lasted.','A soft start-up sound, a tidier control area on Devices, more on the clock card, and the whole app now scales up on wide screens and TVs.']},\n  '3.1.1':{t:'New sounds',items:['The chimes are new: soft, glassy two-note tones with a little echo. A rising pair when a light turns on, a falling pair when it turns off. Volume is still in Settings.']},\n  '3.1.0':{t:'24 new backgrounds',items:['Settings, Background now has 38 choices: Nebula, Ocean waves, Synthwave, Bokeh, Lava lamp, Spotlight (follows your pointer), Plasma, Prism, City at night, Fireflies, Embers, Digital rain, Bubbles, Star warp, and still ones like Mesh gradient, Sunset, Honeycomb, Circuit board, Blueprint, Film grain, Mountains, Stripes, Checkerboard and Glass grid.','Cards turn slightly see-through so the background shows. Moving backgrounds pause when Effects is Off and slow down in Subtle.']},\n  '3.0.0':{t:'Lumora 3',items:['A completely new design, built from scratch. The home screen is now a calm “Now” view with a live clock, a ring showing how many lights are on, and tall light cards that fill up like a glass as you turn them up.','The whole room glows in the colour of the lights you have on.','A floating menu at the bottom, and a Today panel (calendar, notifications, account) that slides in from the right.','Six new looks: Nocturne, Daylight, Ember, Lagoon, Porcelain and Mono. Effects can be turned down or off in Settings, and slow screens drop to a lighter mode on their own.','Sturdier: a bar appears if the server can’t be reached, a recovery screen replaces a blank page, Settings shows a health report, and you can download and restore a backup.']},")

# modern sounds
a=s.index("function chime(up){"); e=s.index("function setSound(on){")
s=s[:a]+"""let fxBus=null;
function soundBus(){
  if(fxBus&&fxBus.ctx===actx) return fxBus.out;
  const c=actx, out=c.createGain(), lp=c.createBiquadFilter(), comp=c.createDynamicsCompressor(), conv=c.createConvolver(), wet=c.createGain();
  lp.type='lowpass'; lp.frequency.value=6200; lp.Q.value=.4; wet.gain.value=.3;
  const len=Math.floor(c.sampleRate*1.5), buf=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){ const d=buf.getChannelData(ch); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.4); }
  conv.buffer=buf; out.connect(lp); lp.connect(comp); comp.connect(c.destination); lp.connect(conv); conv.connect(wet); wet.connect(comp);
  fxBus={ctx:c,out}; return out;
}
/* soft glassy two-note chimes: up = lights on, down = lights off */
function chime(up){
  if(!soundOn) return;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state==='suspended') actx.resume();
    const c=actx, bus=soundBus(), t=c.currentTime+.01, vol=Math.max(.0002,settings.volume/100);
    const voice=(f,start,peak,decay,glide)=>{
      [[1,'sine',1],[2.003,'sine',.22],[3.01,'triangle',.07]].forEach(([m,type,lv])=>{
        const o=c.createOscillator(), g=c.createGain(), s=t+start;
        o.type=type; o.frequency.setValueAtTime(f*m*(glide?.985:1),s); if(glide) o.frequency.exponentialRampToValueAtTime(f*m,s+.05);
        g.gain.setValueAtTime(.0001,s); g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak*lv*vol),s+.008); g.gain.exponentialRampToValueAtTime(.0001,s+decay);
        o.connect(g); g.connect(bus); o.start(s); o.stop(s+decay+.05);
      });
    };
    if(up){ voice(659.25,0,.2,.55,true); voice(987.77,.075,.2,.7,true); voice(1318.5,.16,.07,.5,false); }
    else{ voice(783.99,0,.17,.5,false); voice(523.25,.09,.17,.75,false); }
  }catch(e){}
}
/* soft start-up swell: a slow, warm rising chord with a long echo (plays once per page load) */
let bootPlayed=false;
function bootSound(){
  if(bootPlayed||!soundOn) return true;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state==='suspended'){ actx.resume(); if(actx.state==='suspended') return false; }
    bootPlayed=true;
    const c=actx, bus=soundBus(), t=c.currentTime+.03, vol=Math.max(.0002,settings.volume/100);
    const note=(f,start,peak,hold,decay)=>{
      [[1,'sine',1],[2.002,'sine',.18],[.5,'sine',.25]].forEach(([m,type,lv])=>{
        const o=c.createOscillator(), g=c.createGain(), s=t+start, p=Math.max(.0002,peak*lv*vol);
        o.type=type; o.frequency.setValueAtTime(f*m,s);
        g.gain.setValueAtTime(.0001,s); g.gain.exponentialRampToValueAtTime(p,s+.35); g.gain.setValueAtTime(p,s+.35+hold); g.gain.exponentialRampToValueAtTime(.0001,s+.35+hold+decay);
        o.connect(g); g.connect(bus); o.start(s); o.stop(s+.4+hold+decay);
      });
    };
    note(329.63,0,.13,.15,1.3); note(493.88,.16,.12,.15,1.4); note(659.25,.34,.11,.2,1.6); note(830.61,.56,.08,.2,2.1);
    return true;
  }catch(e){ return true; }
}
function bootSoundWhenAllowed(){
  if(bootSound()) return;
  const go=()=>{ removeEventListener('pointerdown',go,true); removeEventListener('keydown',go,true); bootSound(); };
  addEventListener('pointerdown',go,true); addEventListener('keydown',go,true);
}
"""+s[e:]

rep("$('splash').classList.add('out'); setTimeout(()=>$('splash').remove(),600); boot();","$('splash').classList.add('out'); setTimeout(()=>$('splash').remove(),600); boot(); setTimeout(bootSoundWhenAllowed,250);")

# backgrounds
bgcss=open('/tmp/v3/bg.css').read(); bgjs=open('/tmp/v3/bg.js').read()
rep("</style>",bgcss+"</style>")
rep("/* ---- backgrounds ---- */\n(function(){",bgjs+"/* ---- backgrounds ---- */\n(function(){")
rep("['waves','Waves','animated'],['auto','Automatic','auto'],","['waves','Room glow only','default'],['auto','Automatic','auto'],")
rep("['plain','Plain','static'],['soft','Soft glow','static'],['dots','Dots','static'],['topo','Contours','static'],['tri','Triangles','static'],","['plain','Plain','static'],['soft','Soft glow','static'],['dots','Dots','static'],['topo','Contours','static'],['tri','Triangles','static'],['mesh','Mesh gradient','static'],['sunset','Sunset','static'],['hex','Honeycomb','static'],['circuit','Circuit board','static'],['blue','Blueprint','static'],['grain','Film grain','static'],['mount','Mountains','static'],['stripes','Stripes','static'],['checker','Checkerboard','static'],['glassgrid','Glass grid','static'],['carbon','Carbon fibre (dark)','static'],['marble','Black marble (dark)','static'],['deepsea','Deep sea rays (dark)','animated'],['galaxy','Galaxy swirl (dark)','animated'],['ripples','Moon ripples (dark)','animated'],")
rep("['rain','Rain','animated']","['rain','Rain','animated'],['nebula','Nebula','animated'],['ocean','Ocean waves','animated'],['synth','Synthwave','animated'],['bokeh','Bokeh','animated'],['lava','Lava lamp','animated'],['spot','Spotlight','animated'],['plasma','Plasma','animated'],['prism','Prism','animated'],['city','City at night','animated'],['fireflies','Fireflies','animated'],['embers','Embers','animated'],['digital','Digital rain','animated'],['bubbles','Bubbles','animated'],['warp','Star warp','animated']")
rep("return !!(RM.matches||r||root.dataset.motion==='reduced'); };","return !!(RM.matches||r||root.dataset.motion==='reduced'||root.dataset.fx==='off'); };")
rep("    else if(k==='snow'||k==='rain'){","""    else if(BGN.css[k]){ BGN.css[k](el); }
    else if(BGN.canvas.includes(k)){
      cv=document.createElement('canvas'); fx.appendChild(cv); ctx=cv.getContext('2d'); fit(); kind=k; parts=BGN.init(k,innerWidth,innerHeight);
      lastT=0; draw(performance.now()); if(!still_()&&!document.hidden) raf=requestAnimationFrame(loop);
      return;
    }
    else if(k==='snow'||k==='rain'){""")
rep("    } else {\n      ctx.globalAlpha=.35; ctx.lineWidth=1.2;","    } else if(BGN.draw[kind]){\n      BGN.draw[kind](ctx,parts,t,dt,W,H,inkColor());\n    } else {\n      ctx.globalAlpha=.35; ctx.lineWidth=1.2;")
rep("    if(k==='plain'){ el.className='bgx-plain'; }","    if(BGN.v2&&BGN.v2.has(k)){ el.className=''; BGN.css[k](el); }\n    else if(k==='plain'){ el.className='bgx-plain'; }")
rep("    if(kind==='snow'){\n      ctx.globalAlpha=.7;","    if(BGN.draw[kind]){ BGN.draw[kind](ctx,parts,t,dt,W,H,inkColor()); }\n    else if(kind==='snow'){\n      ctx.globalAlpha=.7;")
rep("const g=type==='auto'?'Automatic':type==='static'?'Still':'Moving'; ","const g=type==='default'?'Default':type==='auto'?'Automatic':type==='static'?'Still':'Moving'; ")

# ---- 3.2.0 patches ----
rep("'hub-money','hub-notify'];","'hub-money','hub-notify','hub-others'];")
rep("    if(!b.user) return;\n    /* from here on","    if(!b.user) return;\n    var __rl=b.user.role; SYNC=SYNC.filter(function(k){ if(__rl==='admin') return true; if(k==='hub-notify') return false; if(k==='hub-money') return b.user.money===true; if(__rl==='guest') return k==='hub-lights'||k==='hub-activity'; return true; });\n    /* from here on")
rep("    case 'manual': return 'I tap its button';","    case 'manual': return 'I tap its button';\n    case 'sensor': case 'lockev': case 'temp': return window.__othText(t.type,t);")
rep("    case 'wait': return 'wait '+a.n+(a.unit==='m'?' min':' sec');","    case 'wait': return 'wait '+a.n+(a.unit==='m'?' min':' sec');\n    case 'plug': case 'therm': case 'lock': return window.__othText(a.k,a);")
rep("    case 'lighton': return lightName(c.id)+' is '+(c.v==='on'?'on':'off');\n  }\n  return 'a condition is met';","    case 'lighton': return lightName(c.id)+' is '+(c.v==='on'?'on':'off');\n    case 'othstate': return window.__othText('othstate',c);\n  }\n  return 'a condition is met';")
rep("    case 'lighton': { const d=state.find(x=>x.id===c.id);","    case 'othstate': return window.__othCond(c);\n    case 'lighton': { const d=state.find(x=>x.id===c.id);")
rep("    case 'wait': await waitMs((a.unit==='m'?60000:1000)*a.n); break;","    case 'plug': case 'therm': case 'lock': await window.__othAct(a.k==='plug'?Object.assign({k2:'plug'},a):a.k==='lock'?Object.assign({k2:'lock'},a):a); break;\n    case 'wait': await waitMs((a.unit==='m'?60000:1000)*a.n); break;")
rep("    }else r=await srvApi('POST','/api/login',{email,password:pw,keep:$('lKeep').checked});\n    if(!r.ok) return err(say(r));","    }else r=await srvApi('POST','/api/login',{email,password:pw,keep:$('lKeep').checked});\n    if(r.ok&&r.json&&r.json.need2fa){ $('lPw').value=''; return window.__ask2fa(r.json.ticket,$('lKeep').checked); }\n    if(!r.ok) return err(say(r));")
# household list
i=s.index("      (r.json.users||[]).forEach(u=>{\n        const row=document.createElement('div'); row.className='srow';")
j=s.index("        box.appendChild(row);\n      });",i)+len("        box.appendChild(row);\n      });")
s=s[:i]+"      (r.json.users||[]).forEach(u=>box.appendChild(window.__hhRow(u,renderHH,$('hhMsg'))));"+s[j:]
rep("password:$('hhPw').value});\n      if(r.ok){ $('hhMsg').textContent='Added","password:$('hhPw').value,role:($('hhRole')||{}).value||'family'});\n      if(r.ok){ $('hhMsg').textContent='Added")
rep("People who can sign in to this Lumora server. They all see and control the same lights.","People who can sign in to this Lumora server. Choose what each person can see.")
rep("</style>",open('/tmp/v3/others.css').read()+open('/tmp/v3/gfx.css').read()+open('/tmp/v3/xmas.css').read()+open('/tmp/v3/splash2.css').read()+open('/tmp/v3/today.css').read()+open('/tmp/v3/watch.css').read()+open('/tmp/v3/voice.css').read()+open('/tmp/v3/home.css').read()+open('/tmp/v3/auto6.css').read()+open('/tmp/v3/security.css').read()+open('/tmp/v3/offline.css').read()+open('/tmp/v3/fix601.css').read()+open('/tmp/v3/chrome61.css').read()+open('/tmp/v3/bluetooth.css').read()+open('/tmp/v3/sleep.css').read()+open('/tmp/v3/music.css').read()+open('/tmp/v3/settings6.css').read()+open('/tmp/v3/fullscreen.css').read()+open('/tmp/v3/v7/v7.css').read()+"</style>")

# ---- close button for the colour panel ----
rep("""'<div class="pal" hidden><div class="swatches">'""","""'<div class="pal" hidden><div class="palhead"><b>Colour</b><button class="palx" type="button" aria-label="Close">Done</button></div><div class="swatches">'""")
rep("  el.querySelector('.dot').onclick = ()=>{ openColor = openColor===d.id ? null : d.id; render(); };","  el.querySelector('.dot').onclick = ()=>{ openColor = openColor===d.id ? null : d.id; render(); };\n  el.querySelector('.palx').onclick = ()=>{ openColor=null; render(); const dt=el.querySelector('.dot'); if(dt&&!document.body.dataset.noFocus) dt.focus(); };")
rep("/* ---- 2.4: what's new","""document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&openColor&&!document.querySelector('dialog[open]')){ openColor=null; render(); } });
document.addEventListener('pointerdown',e=>{ if(openColor&&!(e.target.closest&&e.target.closest('.lt'))){ openColor=null; render(); } },true);
/* ---- 2.4: what's new""")

# ---- pop-out window ----
rep("window.__errs=[];","if(/[?&]popout=1/.test(location.search)){document.documentElement.setAttribute('data-popout','1');document.title='Lumora pop-out';}window.__errs=[];")
rep("<main>\n","<main>\n<div id=\"popHead\"><span class=\"brand\" data-brand></span><span class=\"grow\"></span><span class=\"popclock\" id=\"popClock\" aria-live=\"off\"></span><span class=\"popcount\" id=\"popCount\"></span><button class=\"btn sm\" id=\"popAllOff\" type=\"button\">All lights off</button><a class=\"btn sm\" id=\"popBack\" href=\"./\" target=\"_blank\" rel=\"noopener\">Open full app</a></div>\n")
rep("  <button class=\"btn sm\" id=\"todayClose\" type=\"button\" style=\"align-self:flex-end\">Close</button>","  <div class=\"todaytop\"><button class=\"btn sm\" id=\"popOutBtn\" type=\"button\" title=\"Open notifications and lights in their own small window\">Pop out</button><button class=\"btn sm\" id=\"todayClose\" type=\"button\">Close</button></div>")
rep("<h2>Lights <span class=\"sub\" id=\"lcount\"></span></h2>","<h2>Lights <span class=\"sub\" id=\"lcount\"></span> <button class=\"btn sm popchip\" id=\"popOutBtn2\" type=\"button\" title=\"Open notifications and lights in their own small window\">Pop out</button></h2>")
rep("/* ---- 2.4: what's new","""(function(){
  const POP=document.documentElement.dataset.popout==='1';
  if(POP){
    /* the pop-out only shows things; automations keep running in the main window so nothing fires twice */
    runRule=async function(){}; bootPlayed=true;
    try{ document.body.dataset.tvhint=''; }catch(e){}
    document.addEventListener('DOMContentLoaded',()=>{ try{ showTab('Devices'); }catch(e){} });
    const tick=()=>{ const c=document.getElementById('popClock'); if(c) c.textContent=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}); const n=document.getElementById('popCount'); if(n&&typeof state!=='undefined'){ const live=state.filter(d=>d.online!==false); n.textContent=live.filter(d=>d.on).length+' of '+state.length+' on'; } };
    setInterval(tick,1000); setTimeout(tick,400);
    document.addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('#popAllOff')) try{ doAct({k:'scene',name:'All off'}); }catch(x){} });
    /* remember where the person put and sized the window */
    let lb='';
    setInterval(()=>{ const b=[outerWidth,outerHeight,screenX,screenY].join(','); if(b===lb) return; lb=b; try{ localStorage.setItem('hub-popbox',JSON.stringify({w:outerWidth,h:outerHeight,x:screenX,y:screenY})); }catch(e){} },1500);
    setTimeout(()=>{ try{ showTab('Devices'); }catch(e){} },300);
  }
  const open=()=>{
    let bx=null; try{ bx=JSON.parse(localStorage.getItem('hub-popbox')||'null'); }catch(e){}
    const W=bx&&bx.w>=280?bx.w:400, H=bx&&bx.h>=300?bx.h:720, X=bx&&isFinite(bx.x)?Math.max(0,Math.min(bx.x,screen.availWidth-120)):Math.max(0,screen.availWidth-440), Y=bx&&isFinite(bx.y)?Math.max(0,Math.min(bx.y,screen.availHeight-120)):60;
    const w=window.open(location.pathname+'?popout=1','lumora-popout','popup=yes,width='+W+',height='+H+',left='+X+',top='+Y);
    if(!w){ toast('Your browser blocked the pop-out window. Allow pop-ups for this page and try again.'); return; }
    try{ w.focus(); }catch(e){}
  };
  ['popOutBtn','popOutBtn2'].forEach(id=>{ const b=document.getElementById(id); if(b) b.onclick=open; });
})();
/* ---- 2.4: what's new""")
rep("'3.2.2':{t:'Back to the usual size'","'3.4.0':{t:'Status lamps and holidays',items:['The clock card now shows the next holiday and how many days away it is (Canadian and Nova Scotia holidays, plus Halloween, Mother’s Day and similar).','A floating tab on the left edge works like the warning lights on a car dashboard: lamps for power cut, light offline, server link, doors open, locks unlocked, low camera battery, lights on, heating, motion and away mode. Lit lamps glow, quiet ones stay dim. Tap the arrow to see what each one says, or tap a lamp to jump to the right place.']},\n  '3.3.0':{t:'Pop-out window (beta)',items:['New: Pop out opens notifications and your lights in their own small window you can keep beside other work. Find it in the Today panel or next to Lights. This is a beta, so tell me what feels off.']},\n  '3.2.2':{t:'Back to the usual size'")
rep("APP_VERSION='3.2.2'","APP_VERSION='3.4.0'")

# ---- 4.0 graphics and icons ----
icons=open('/tmp/v3/icons.js').read()
import re as _re
i=s.index("const TAB_ICONS={"); j=s.index("};",i)+2
s=s[:i]+icons+"const TAB_ICONS={Devices:icoInner('home'),Automations:icoInner('bolt'),Activity:icoInner('pulse'),Clock:icoInner('clock'),Sky:icoInner('sky'),Money:icoInner('wallet'),Apps:icoInner('apps'),Settings:icoInner('sliders')};"+s[j:]
# card bulb, star
s,n=_re.subn(r'(<button class="bulb" data-key="t-\'\+d\.id\+\'" aria-pressed="false">)<svg[^>]*>.*?</svg>(<span class="tbadge")',lambda m:m.group(1)+"'+ICO('bulb','bulbi')+'"+m.group(2),s,count=1,flags=_re.S)
assert n==1,'bulb'
rep("aria-pressed=\"false\">☆</button>","aria-pressed=\"false\">'+ICO('star')+'</button>")
rep("st.textContent = d.fav ? '★' : '☆'; ","")
# today button icon
s,n=_re.subn(r'(<button id="todayBtn"[^>]*>)<svg.*?</svg>',lambda m:m.group(1)+"<span class=\"icw\" data-ico=\"cal\"></span>",s,count=1,flags=_re.S); assert n==1
rep("const MARK='<span class=\"mark\">","const MARKSVG_OLD='<span class=\"mark\">")
rep("document.querySelectorAll('[data-brand]').forEach(e=>e.innerHTML=MARK);","const MARK='<span class=\"mark\">'+LOGO+'</span><span>Lumora</span>';\nlet _bn=0;document.querySelectorAll('[data-brand]').forEach(e=>{ const k='_'+(_bn++); e.innerHTML=MARK.replace(/id=\"(k9\\w)\"/g,'id=\"$1'+k+'\"').replace(/url\\(#(k9\\w)\\)/g,'url(#$1'+k+')'); });")

fav=open('/tmp/v3/fav.txt').read()
import re as _r2
s=_r2.sub(r'<link rel="icon" type="image/svg\+xml" href="[^"]*">','<link rel="icon" type="image/svg+xml" href="'+fav+'">',s,count=1)
rep("APP_VERSION='3.4.0'","APP_VERSION='4.0.0'")
rep("'3.4.0':{t:'Status lamps and holidays'","'4.0.0':{t:'Lumora 4: new look and icons',items:['A new set of icons drawn for Lumora, with a soft two-tone fill, used in the menu, light cards, stars, scenes and headings.','A new logo and app icon, and glossier cards, a glowing status ring and a livelier menu bar.','Small animations when a light turns on, a favourite is starred or a tab opens. They switch off with Effects off or Reduce motion.']},\n  '3.4.0':{t:'Status lamps and holidays'")

rep('''$('wxIc').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"''','''$('wxIc').innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" fill-opacity=".16" stroke="currentColor"''')
rep("APP_VERSION='4.0.0'","APP_VERSION='4.0.1'")
rep("'4.0.0':{t:'Lumora 4: new look and icons'","'4.0.1':{t:'More new icons',items:['The weather icons and the status lamps on the left tab now use the new icon set too.']},\n  '4.0.0':{t:'Lumora 4: new look and icons'")

rep("sw.setAttribute('aria-label','Enabled: '+ruleTitle(r)); sw.innerHTML='<i></i>';","sw.setAttribute('aria-label','Enabled: '+ruleTitle(r)); sw.classList.toggle('on',!!r.on); sw.innerHTML='<i></i>';")
exec(open('/tmp/v3/p41.py').read())
exec(open('/tmp/v3/rename.py').read())
open(out,'w').write(s)
print(len(s))
