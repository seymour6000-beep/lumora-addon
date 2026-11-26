# ---- 4.1 server-side automations ----
rep("'hub-money','hub-notify','hub-others'];","'hub-money','hub-notify','hub-others','hub-autostat'];")
rep("tvMode:'auto',fxMode:'auto',","tvMode:'auto',fxMode:'auto',serverAuto:true,")
rep('''  <div class="mrow"><span>Pause all automations</span><button class="sw" role="switch" data-set="pauseAll" aria-label="Pause all automations"><i></i></button></div>
</div>''','''  <div class="mrow"><span>Pause all automations</span><button class="sw" role="switch" data-set="pauseAll" aria-label="Pause all automations"><i></i></button></div>
  <div class="mrow" data-remote-only><span>Run on the server</span><button class="sw" role="switch" data-set="serverAuto" aria-label="Run automations on the server"><i></i></button></div>
</div>
<p class="sub" data-remote-only id="srvAutoNote">On: your automations keep running when no browser is open. This covers times, sunrise and sunset, door and motion sensors, locks, temperature, “light left on”, “light offline”, and home or away. Camera motion and power-cut triggers still need a Lumora page open.</p>''')
rep("const saveRules=()=>{ try{ localStorage.setItem('hub-rules',JSON.stringify(rules)); }catch(e){} };","""const saveRules=()=>{ try{ localStorage.setItem('hub-rules',JSON.stringify(rules)); }catch(e){} };
try{ const st=JSON.parse(localStorage.getItem('hub-autostat')||'{}'); rules.forEach(r=>{ const x=st[r.id]; if(!x) return; if(x.last&&(!r.last||x.last>r.last)) r.last=x.last; if(x.count>(r.count||0)) r.count=x.count; if(x.done) r.on=false; }); }catch(e){}""")
rep("async function runRule(r,o){\n  o=o||{}; const ctx=o.ctx||{};","""async function runRule(r,o){
  o=o||{}; const ctx=o.ctx||{};
  if(window.__srvAuto&&window.__srvAuto(r)){
    if(o.force){ if(window.__srvFlush) await window.__srvFlush(); const x=await srvApi('POST','/api/automations/'+encodeURIComponent(r.id)+'/run'); if(!x.ok) toast('The server couldn’t run that.'); else{ r.last=Date.now(); r.count=(r.count||0)+1; saveRules(); renderRules(); } }
    return;
  }""")
rep("APP_VERSION='4.0.1'","APP_VERSION='4.1.0'")
rep("'4.0.1':{t:'More new icons'","'4.1.0':{t:'Automations run on the server',items:['Your automations now run inside Lumora on your Home Assistant, so they keep working when no browser is open. This covers set times, sunrise and sunset, door and motion sensors, locks, temperature, “light left on”, “light offline” and home or away.','A new switch at the top of Automations, Run on the server, turns this on or off. When it is on, the browser stands back so nothing runs twice. Camera motion and power-cut rules still need a Lumora page open.','Automations can lock a door but never unlock one. Last-run times and counts are kept on the server too.']},\n  '4.0.1':{t:'More new icons'")

rep("APP_VERSION='4.1.0'","APP_VERSION='4.2.0'")
rep("'4.1.0':{t:'Automations run on the server'","'4.2.0':{t:'Energy estimates and CSV',items:['Usage history now shows an estimate of the energy your lights used and what it cost. Set watts per light and your price per kWh right above the chart.','Download CSV saves the history (minutes on per light per day, estimated kWh and offline events) so you can open it in a spreadsheet.']},\n  '4.1.0':{t:'Automations run on the server'")

rep("APP_VERSION='4.2.0'","APP_VERSION='4.3.0'")
rep("'4.2.0':{t:'Energy estimates and CSV'","'4.3.0':{t:'Quick commands',items:['Press Ctrl+K (or /, or tap the magnifier at the top) to search and do things fast: turn a light on or off, run a scene, switch a plug, lock a door or jump to any page.','Alt+1 to Alt+8 open the pages in order.']},\n  '4.2.0':{t:'Energy estimates and CSV'")
rep("APP_VERSION='4.3.0'","APP_VERSION='4.4.0'")
rep("'4.3.0':{t:'Quick commands'","'4.4.0':{t:'Polish and docs',items:['Quick commands now accept typing the moment they open.','Documentation updated for quick commands, energy, pop-out and status lamps.']},\n  '4.3.0':{t:'Quick commands'")
rep("APP_VERSION='4.4.0'","APP_VERSION='4.5.0'")
rep("'4.4.0':{t:'Polish and docs'","'4.5.0':{t:'Christmas season',items:['From December 1 to January 5 Lumora turns festive by itself: green and red colours, falling snow and a twinkling garland.','It adds three Christmas lighting automations (lights on at sunset, green at 8 pm, off at 11 pm). Edit or delete them any time; they switch themselves off after January 5.','New scenes: Christmas, Christmas tree and Christmas gold.','Press Ctrl+K and type Christmas to turn the theme off or on.']},\n  '4.4.0':{t:'Polish and docs'")
rep("APP_VERSION='4.5.0'","APP_VERSION='4.6.0'")
rep("boot(); setTimeout(bootSoundWhenAllowed,250);","boot(); setTimeout(bootSoundWhenAllowed,250); try{window.__claudeSplash();}catch(e){}")
rep("tag.textContent='v'+cur+' · update available'","tag.textContent='Update available'")
rep("'4.5.0':{t:'Christmas season'","'4.6.0':{t:'3D logos and a new splash',items:['After the Lumora splash, a short Made by Claude AI screen plays.','The Lumora logo and every icon were redrawn with a 3D look: raised edges, depth and soft shadows.','The version number moved to Settings (About Lumora). It only appears on the main screen when an update is waiting.']},\n  '4.5.0':{t:'Christmas season'")
rep("APP_VERSION='4.6.0'","APP_VERSION='4.7.0'")
rep("'4.6.0':{t:'3D logos and a new splash'","'4.7.0':{t:'New Today panel',items:['The calendar, clock and notifications panel was redesigned to match the new look: a raised clock card, a calendar with rounded days and a glowing today, and notification cards with a coloured edge.']},\n  '4.6.0':{t:'3D logos and a new splash'")
rep("APP_VERSION='4.7.0'","APP_VERSION='4.8.0'")
rep("'hub-notify','hub-others','hub-autostat'];","'hub-notify','hub-others','hub-autostat','hub-watch'];")
rep("if(settings.popups) toast(d.name+(first?' is offline':' went offline'),FIX_TIPS);","if(settings.popups&&!(window.__watchMuted&&window.__watchMuted(d.id))) toast(d.name+(first?' is offline':' went offline'),FIX_TIPS);")
rep("if(settings.popups) toast(d.name+' is back online'); log(d.name+' is back online'); }\n    seen[d.id]=now;","if(settings.popups&&!(window.__watchMuted&&window.__watchMuted(d.id))) toast(d.name+' is back online'); log(d.name+' is back online'); }\n    seen[d.id]=now; try{ window.__watchSeen&&window.__watchSeen(d,now); }catch(e){}")
rep("else state.filter(d=>d.online===false).forEach(d=>out.push({k:'off:'+d.id,lv:'warn',t:d.name+' is offline',d:'It will clear when the light comes back.',tips:FIX_TIPS}));","else state.filter(d=>d.online===false&&!(window.__watchMuted&&window.__watchMuted(d.id))).forEach(d=>out.push({k:'off:'+d.id,lv:'warn',t:d.name+' is offline',d:(window.__watchSince?window.__watchSince(d.id):'')+'It will clear when the light comes back.',tips:FIX_TIPS}));\n    (window.__watchNotes?window.__watchNotes():[]).forEach(i=>out.push(i));")
rep("'4.7.0':{t:'New Today panel'","'4.8.0':{t:'Light watch',items:['New Light watch settings: choose how long to wait before a phone alert, get reminders while a light stays offline, and be told when it comes back and how long it was away.','Lumora now spots a light that keeps dropping out, and several lights dropping together (usually the router or Wi-Fi).','Quiet hours stop phone alerts overnight, and you can stop watching a light you unplug on purpose.','A health report shows each light\\u2019s time online, drop-outs and longest outage.']},\n  '4.7.0':{t:'New Today panel'")
rep("APP_VERSION='4.8.0'","APP_VERSION='4.8.1'")
rep("<p>Install the Lumora TV app, then give it this server address:</p>\n  <p class=\"tvaddr\" id=\"tvAddr\"></p>","<p><b>Easiest way for Google TV or Android TV, three steps:</b></p>\n  <ol class=\"tvsteps\"><li>On the TV, install the free <b>Downloader</b> app from the Play Store and open it.</li><li>In Downloader’s address box type this short address, choose Go, then Install:</li></ol>\n  <p class=\"tvaddr\" id=\"tvApk\"></p>\n  <ol class=\"tvsteps\" start=\"3\"><li>Open <b>Lumora</b> on the TV, choose <b>Find my server automatically</b>, then <b>Sign in with a code from my phone</b>. If it can’t find the server, type this address:</li></ol>\n  <p class=\"tvaddr\" id=\"tvAddr\"></p>")
rep("<li><b>Google TV or Android TV:</b> install the Lumora TV app (Lumora-TV.apk from the add-on’s GitHub page, Releases) with the Downloader app or adb, open it, and enter the address above.</li>","<li><b>Google TV or Android TV:</b> follow the three steps above. The same page is at <b>/tv</b> on your server if you would rather read the steps on the TV.</li>")
rep("const a=$('tvAddr'); if(!a) return; a.textContent=location.origin+'/?tv=1';","const a=$('tvAddr'); if(!a) return; a.textContent=location.origin+'/?tv=1'; if($('tvApk')) $('tvApk').textContent=location.host+'/tv.apk';")
rep("'4.8.0':{t:'Light watch'","'4.8.1':{t:'Easier TV install',items:['Installing on Google TV or Android TV is now three steps: Downloader app, type your server address followed by /tv.apk, then sign in with a code. The steps are in Settings, Use Lumora on a TV, and on a page at /tv on your server.']},\n  '4.8.0':{t:'Light watch'")
rep("APP_VERSION='4.8.1'","APP_VERSION='4.9.0'")
rep("'4.8.1':{t:'Easier TV install'","'4.9.0':{t:'Pop-out window is final',items:['The pop-out window is no longer a beta.','It now shows the time and how many lights are on, has an All lights off button, and remembers its size and position.']},\n  '4.8.1':{t:'Easier TV install'")
rep("APP_VERSION='4.9.0'","APP_VERSION='4.10.0'")
rep("'hub-others','hub-autostat','hub-watch'];","'hub-others','hub-autostat','hub-watch','hub-voice','hub-security','hub-sleep'];")
rep("'4.9.0':{t:'Pop-out window is final'","'4.10.0':{t:'Google Home, Alexa and server address',items:['New Google Home and Alexa settings: Lumora shares your scenes with Home Assistant so you can say them out loud, lists phrases to try for your own lights, and has step-by-step setup for both assistants.','The address of your server is now at the bottom of Settings, with a Copy button.']},\n  '4.9.0':{t:'Pop-out window is final'")
rep("APP_VERSION='4.10.0'","APP_VERSION='4.11.0'")
rep("'4.10.0':{t:'Google Home, Alexa and server address'","'4.11.0':{t:'Lumora for Windows',items:['There is now a Windows desktop app: a system tray icon, Windows alerts for new warnings, an always-on-top pop-out, and automatic updates. Download it from Settings, Lumora for Windows.']},\n  '4.10.0':{t:'Google Home, Alexa and server address'")
rep("APP_VERSION='4.11.0'","APP_VERSION='5.0.0'")
rep("'4.11.0':{t:'Lumora for Windows'","'5.0.0':{t:'Welcome to Lumora 5',items:['A new look: 3D logo and icons, a redesigned Today panel, and a festive Christmas theme from December 1 to January 5 with its own lighting automations.','Automations now run on the server, so they work with every browser closed.','Light watch: delayed and repeat alerts, drop-out and router-problem detection, quiet hours and a health report for every light.','Command palette (Ctrl+K), an energy estimate with CSV export, a status-lamp side tab and a pop-out window that stays on top.','Google Home and Alexa through Home Assistant, a Windows desktop app, and an easier Android TV install.','The server address is at the bottom of Settings, and the version number is in Settings, About Lumora.']},\n  '4.11.0':{t:'Lumora for Windows'")
rep("APP_VERSION='5.0.0'","APP_VERSION='6.0.0'")
exec(open('/tmp/v3/p61.py').read())
exec(open('/tmp/v3/auto7.py').read())
exec(open('/tmp/v3/notes6.py').read())
