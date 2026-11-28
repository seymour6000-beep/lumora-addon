# Lumora 7: delete every old style and ship the new design system (plus the background effects and the seasonal skins, which are features)
import re as _re
_i=s.index('<style>'); _j=s.index('</style>')
_keep=open('/tmp/v3/bg.css').read()+open('/tmp/v3/xmas.css').read()
s=s[:_i]+'<style>'+open('/tmp/v3/v7/core.css').read()+_keep+open('/tmp/v3/v7/v7.css').read()+s[_j:]
# 8.1.2: cameras are removed from the app
s=s.replace("const MAX_LIGHTS=30, MAX_CAMS=30;","const MAX_LIGHTS=30, MAX_CAMS=0;",1)
s=s.replace("if(Array.isArray(sc)) cams=sc.filter(c=>c&&c.id&&c.name); else if(REMOTE) cams=[];","cams=[];",1)
s=s.replace('placeholder="Search lights and cameras"','placeholder="Search lights"').replace("Search lights and cameras","Search lights")
s=s.replace("Devices and cameras","Devices and sensors").replace("Sensors, locks, cameras and power cuts","Sensors, locks and power cuts")
s=s.replace("Your lights and cameras, in one place.","Your lights, in one place.")
import re as _re
# 8.3: camera leftovers
s=_re.sub(r"\n  \{n:'Motion lights the porch'.*?\n(?=  \{n:)","\n",s,count=1,flags=_re.S) if "{n:'Motion lights the porch'" in s else s
s=_re.sub(r"\n  \{n:'Camera battery reminder'.*?\n(?=  \{n:)","\n",s,count=1,flags=_re.S) if "{n:'Camera battery reminder'" in s else s
s=s.replace("  motion:{l:'A camera detects motion',f:[{n:'cam',t:'sel',l:'Camera',o:camOpts}]},\n","",1)
s=s.replace("  nomotion:{l:'A camera sees no motion for a while',f:[{n:'cam',t:'sel',l:'Camera',o:camOpts},{n:'mins',t:'num',l:'Minutes',d:10,min:1,max:240}]},\n","",1)
s=s.replace("  {id:'r1',on:true,name:'',t:{type:'motion',cam:'Front door'},c:[],acts:[{k:'light',id:'porch',op:'on',mins:0}],once:false,last:null,count:0},\n","",1)
s=s.replace(" Camera motion would reach the hub through Alexa or Google Home, so use the test button at the bottom to try it here."," Use the test button at the bottom to try a rule.")
s=s.replace("The button shows in the left bar.","The button shows on the Devices page.")
s=_re.sub(r" \{id:'(aosu|reolink|ring|eufy|arlo|blink)',name:'[^']*',cat:\['Cameras'\][^\n]*\n","",s)
s=s.replace(",'Cameras'],site",  "],site").replace("cat:['Lights'],site","cat:['Lights'],site")
s=s.replace("['All','Lights','Cameras','Hubs']","['All','Lights','Hubs']").replace('<option>Lights</option><option>Cameras</option><option>Hubs</option>','<option>Lights</option><option>Hubs</option>')

s=s.replace("if(Array.isArray(s)) rules=s.map(migrate).filter(Boolean);","if(Array.isArray(s)) rules=s.map(migrate).filter(r=>r&&r.t&&r.t.type!=='motion'&&r.t.type!=='nomotion');",1)

_PANEL='<div class="panel" id="ytPanel"><h3>YouTube alerts</h3><p class="sub">A message appears in the bottom-left corner when one of these channels uploads a video today. It stays until you press ✕, and it beeps twice once when it arrives.</p><div class="srow"><span>YouTube alerts</span><button class="sw" role="switch" id="ytOn" aria-label="YouTube alerts"><i></i></button></div><div class="srow"><span>Double beep</span><button class="sw" role="switch" id="ytSnd" aria-label="Double beep"><i></i></button></div><div id="ytList"></div><div class="srow"><input class="in" id="ytAdd" placeholder="Channel handle" maxlength="80" aria-label="Channel handle" autocomplete="off"><button class="btn" id="ytAddBtn" type="button">Add channel</button></div><div class="srow"><button class="btn" id="ytTest" type="button">Send a test</button><button class="btn" id="ytCheck" type="button">Check now</button></div><p class="sub" id="ytMsg" role="status"></p></div>\n'
_a='<div class="panel wide" id="notifyPanel" hidden>'
assert _a in s
s=s.replace(_a,_PANEL+_a,1)

_o="const draw=()=>{ msg.textContent='Lumora updated to version '+version+'. Reloading in '+n+'s'; fill.style.width=(n*10)+'%'; };"
assert _o in s
s=s.replace(_o,"const draw=()=>{ msg.textContent='Lumora updated to version '+version+'. Reloading in '+n+' seconds.'; fill.style.width=(n*10)+'%'; upBox.dataset.n=n; upBox.style.setProperty('--p',n*10); };",1)
_t="    try{ toast('Lumora was updated to version '+version+'. Reloading in 10 seconds.'); }catch(e){}\n"
assert _t in s
s=s.replace(_t,"",1)
_g="const go=async()=>{ clearInterval(cd); msg.textContent='Reloading…';"
assert _g in s
s=s.replace(_g,"const go=async()=>{ clearInterval(cd); delete upBox.dataset.n; msg.textContent='Reloading…';",1)
_st="$('tbStay').onclick=()=>{ clearInterval(cd); msg.textContent="
assert _st in s
s=s.replace(_st,"$('tbStay').onclick=()=>{ clearInterval(cd); delete upBox.dataset.n; msg.textContent=",1)
