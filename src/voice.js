
/* ---- Lumora 4.10: voice assistants (Google Home, Alexa) and the server address ---- */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const KEY='hub-voice';
  const load=()=>{ let v={}; try{ v=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){} return Object.assign({syncScenes:true},v); };
  let V=load(); const save=()=>{ try{ store.set(KEY,V); }catch(e){ try{ localStorage.setItem(KEY,JSON.stringify(V)); }catch(x){} } };
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const slug=n=>'Lumora '+String(n).toLowerCase();
  function phrases(){
    const out=[]; const lights=(typeof state!=='undefined'?state:[]).slice(0,3), sc=typeof SCENES!=='undefined'?Object.keys(SCENES).filter(n=>n!=='All off').slice(0,2):['Evening'];
    lights.forEach((d,i)=>{ out.push(['Hey Google, turn on the '+d.name,'Alexa, turn on the '+d.name]); if(i===0) out.push(['Hey Google, set the '+d.name+' to 40 percent','Alexa, set the '+d.name+' to 40 percent']); });
    sc.forEach(n=>out.push(['Hey Google, activate '+slug(n),'Alexa, turn on '+slug(n)]));
    out.push(['Hey Google, activate Lumora all off','Alexa, turn on Lumora all off']);
    return out;
  }
  function buildVoice(){
    const host=document.getElementById('probePanel')||document.getElementById('notifyPanel'); if(!host||document.getElementById('voicePanel')) return;
    const p=document.createElement('div'); p.className='panel wide'; p.id='voicePanel';
    p.innerHTML='<h3>Google Home and Alexa</h3><p class="sub">Your lights already live in Home Assistant, so Google Home and Alexa can control them through it. Lumora adds your scenes to Home Assistant as well, so you can say them out loud. Lumora does not talk to Google or Amazon itself. Home Assistant does that part.</p>'+
     '<div class="srow"><span>Share my scenes with Home Assistant</span><button class="sw" role="switch" id="vSync" aria-label="Share my scenes with Home Assistant"><i></i></button></div>'+
     '<div class="nrow"><button class="btn" id="vNow" type="button">Share scenes now</button><span class="sub" id="vMsg" role="status"></span></div>'+
     '<div class="vsteps"><details><summary>Set up Google Home</summary><ol><li>In Home Assistant open <b>Settings, then Voice assistants</b>.</li><li>Turn on <b>Home Assistant Cloud</b> and sign in (a Nabu Casa subscription). Without it, Google needs a free but longer manual setup in Google’s developer console.</li><li>Choose <b>Google Assistant</b>, then <b>Expose</b>, and tick your lights and the scenes that start with <b>Lumora</b>.</li><li>In the Google Home app tap <b>+</b>, <b>Works with Google Home</b>, search for <b>Home Assistant</b> and sign in.</li></ol></details>'+
     '<details><summary>Set up Alexa</summary><ol><li>In Home Assistant open <b>Settings, then Voice assistants</b> and turn on <b>Home Assistant Cloud</b>.</li><li>Choose <b>Alexa</b>, then <b>Expose</b>, and tick your lights and the <b>Lumora</b> scenes.</li><li>In the Alexa app open <b>More, Skills &amp; Games</b>, search for <b>Home Assistant Cloud</b>, enable it and sign in.</li><li>Say <b>“Alexa, discover devices”</b>.</li></ol></details></div>'+
     '<h4 class="hh">Things you can say</h4><div class="vsay" id="vSay"></div><p class="sub" id="vStat"></p>';
    host.parentNode.insertBefore(p,host);
    const b=p.querySelector('#vSync'); const paint=()=>{ b.classList.toggle('on',!!V.syncScenes); b.setAttribute('aria-checked',String(!!V.syncScenes)); }; paint(); b.onclick=()=>{ V.syncScenes=!V.syncScenes; save(); paint(); };
    const msg=p.querySelector('#vMsg'), now=p.querySelector('#vNow');
    if(!REMOTE){ now.disabled=true; b.disabled=true; msg.textContent='Available when Lumora runs as the Home Assistant add-on.'; }
    now.onclick=async()=>{ msg.textContent='Sharing…'; const r=await srvApi('POST','/api/voice/sync',{}); msg.textContent=r.ok&&r.json&&r.json.ok?('Shared '+r.json.count+(r.json.count===1?' scene.':' scenes.')):'Could not share the scenes. '+((r.json&&r.json.error)||'Check that Home Assistant is running.'); status(); };
    drawSay(); status();
  }
  function drawSay(){
    const box=document.getElementById('vSay'); if(!box) return; box.replaceChildren();
    phrases().forEach(([g,a])=>{ const row=document.createElement('div'); row.className='vrow'; const x=document.createElement('span'); x.textContent=g; const y=document.createElement('span'); y.textContent=a; row.append(x,y); box.appendChild(row); });
  }
  async function status(){
    const el=document.getElementById('vStat'); if(!el||!REMOTE) return;
    const r=await srvApi('GET','/api/voice/status'); if(!r.ok||!r.json){ return; }
    const s=r.json; const bits=[];
    bits.push(s.count?('Shared with Home Assistant: '+s.scenes.join(', ')+'.'):'No scenes shared yet.');
    if(s.error) bits.push('Last problem: '+s.error);
    bits.push(s.google?'Google Assistant is set up in Home Assistant.':'Google Assistant is not set up in Home Assistant yet.');
    bits.push(s.alexa?'Alexa is set up in Home Assistant.':'Alexa is not set up in Home Assistant yet (Home Assistant Cloud sets it up from its own page, so this can show “not set up” even when Cloud is on).');
    el.textContent=bits.join(' ');
  }
  /* Lumora for Windows: download steps, or the app's own settings when running inside it */
  function buildDesk(){
    const grid=document.querySelector('section[data-tab="Settings"] .sgrid'); if(!grid||document.getElementById('deskPanel')) return;
    const p=document.createElement('div'); p.className='panel wide'; p.id='deskPanel'; const D=window.lumoraDesktop;
    if(D&&D.isDesktop){
      p.innerHTML='<h3>Lumora for Windows</h3><p class="sub">You are using the desktop app. It stays in the system tray so you get Windows alerts.</p><div id="deskSw"></div><div class="nrow"><button class="btn" id="deskChange" type="button">Change server</button></div>';
      D.getConfig().then(c=>{ const box=p.querySelector('#deskSw'); [['alerts','Windows alerts for new warnings'],['alwaysOnTop','Keep the window on top'],['closeToTray','Close button hides to the tray'],['openAtLogin','Start with Windows']].forEach(([k,l])=>{
        const row=document.createElement('div'); row.className='srow'; const sp=document.createElement('span'); sp.textContent=l; const b=document.createElement('button'); b.className='sw'; b.type='button'; b.setAttribute('role','switch'); b.innerHTML='<i></i>'; b.setAttribute('aria-label',l);
        let on=!!c[k]; const paint=()=>{ b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on)); }; paint(); b.onclick=async()=>{ on=!on; paint(); await D.setConfig(k,on); }; row.append(sp,b); box.appendChild(row); }); });
      p.querySelector('#deskChange').onclick=()=>D.changeServer();
    } else {
      p.innerHTML='<h3>Lumora for Windows</h3><p class="sub">A desktop window for Lumora with Windows alerts, a system tray icon, a pop-out that stays on top, and automatic updates.</p><ol class="tvsteps"><li>Download the installer below and run it. Windows may show a blue “protected your PC” box because the app is not signed. Choose <b>More info</b>, then <b>Run anyway</b>.</li><li>Open Lumora from the Start menu and choose <b>Find my server automatically</b>. If it can’t find it, type <b>'+esc(location.protocol==='file:'?'your server address':location.host)+'</b>.</li><li>Sign in once. The app remembers you.</li></ol><div class="nrow"><a class="btn primary" href="/desktop.exe" id="deskDl">Download for Windows</a><a class="btn" href="https://github.com/seymour6000-beep/lumora-addon/releases/tag/desktop-latest" target="_blank" rel="noopener noreferrer">Other downloads</a></div>';
    }
    const addr=document.getElementById('addrPanel'); if(addr) grid.insertBefore(p,addr); else grid.appendChild(p);
  }
  /* the address of this server, at the bottom of Settings */
  function buildAddr(){
    const grid=document.querySelector('section[data-tab="Settings"] .sgrid'); if(!grid||document.getElementById('addrPanel')) return;
    const p=document.createElement('div'); p.className='panel wide'; p.id='addrPanel';
    const lan=((window.__SRV&&window.__SRV.config&&window.__SRV.config.lan)||[]);
    const port=location.port?':'+location.port:''; const isFile=location.protocol==='file:';
    p.innerHTML='<h3>This server’s address</h3>'+(isFile?'<p class="sub">You are looking at the demo copy of Lumora, so there is no server address yet.</p>':
      '<p class="sub">Use this address on your TV, in the Lumora TV app, or in a browser on another device on your home network.</p><div class="addrlist" id="addrList"></div><p class="sub">The first line is the address this device used to open Lumora. The others are addresses the server found on your network.</p>');
    grid.appendChild(p);
    if(isFile) return;
    const list=p.querySelector('#addrList'); const items=[[location.host,'Used by this device']];
    lan.forEach(ip=>{ const a=ip+(location.port?':'+location.port:''); if(a!==location.host) items.push([a,'Found on the network']); });
    items.forEach(([a,l])=>{ const row=document.createElement('div'); row.className='addrrow'; const t=document.createElement('code'); t.textContent=a; const s=document.createElement('span'); s.className='sub'; s.textContent=l;
      const b=document.createElement('button'); b.className='btn sm'; b.type='button'; b.textContent='Copy'; b.onclick=async()=>{ try{ await navigator.clipboard.writeText('http://'+a); b.textContent='Copied'; }catch(e){ b.textContent='Press Ctrl+C'; try{ const r=document.createRange(); r.selectNodeContents(t); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); }catch(x){} } setTimeout(()=>b.textContent='Copy',1800); };
      row.append(t,s,b); list.appendChild(row); });
  }
  const run=()=>{ try{ buildVoice(); buildAddr(); buildDesk(); }catch(e){} };
  const boot=()=>{ run(); setInterval(()=>{ if(document.getElementById('vSay')&&!document.hidden) drawSay(); },4000); };
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',()=>setTimeout(boot,600)); else setTimeout(boot,600);
  new MutationObserver(()=>{ if(document.body.dataset.auth==='in') run(); }).observe(document.body,{attributes:true,attributeFilter:['data-auth']});
  document.addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('.tab')) setTimeout(()=>{ drawSay(); status(); },400); });
})();
