# colour changes stick: hold what the user asked for while the bulb catches up, and ignore missing or rounded colour reports
rep("""      if(s){ d.on=s.on; d.bri=s.bri; d.color=s.color; if(s.temp) d.temp=s.temp; }""","""      if(s){
        const h=HOLDS.get(d.id), live=h&&Date.now()<h.until, c=(live&&h.c)||{};
        if(!('on' in c)) d.on=s.on; if(!('bri' in c)) d.bri=s.bri;
        if(!('color' in c)&&s.color){ if(h&&h.color&&colorNear(h.color,s.color)){ /* rounding by the bulb: keep the colour that was picked */ } else { d.color=s.color; if(h) h.color=null; } }
        if(!('temp' in c)&&s.temp) d.temp=s.temp;
      }""")
rep("""  const DEVICE_FIELDS=['on','bri','color','temp'];""","""  const DEVICE_FIELDS=['on','bri','color','temp'];
  /* what you just asked a light to do is kept on screen for a few seconds, because bulbs and Home Assistant take a moment to report it back */
  const HOLDS=new Map(), HOLD_MS=8000;
  const hexRgb=x=>{ const m=/^#?([0-9a-f]{6})$/i.exec(String(x||'')); if(!m) return null; const n=parseInt(m[1],16); return [(n>>16)&255,(n>>8)&255,n&255]; };
  const colorNear=(a,b)=>{ const x=hexRgb(a), y=hexRgb(b); return !!(x&&y)&&Math.max(Math.abs(x[0]-y[0]),Math.abs(x[1]-y[1]),Math.abs(x[2]-y[2]))<=40; };
  window.__holds=HOLDS;""")
rep("""    if(Object.keys(cmd).length){ const r=await srvApi('POST','/api/devices/'+encodeURIComponent(id)+'/set',cmd); if(!r.ok) deviceProblem(r); else Object.assign(d,cmd); }""","""    if(Object.keys(cmd).length){
      const prev=HOLDS.get(id); HOLDS.set(id,{c:cmd,until:Date.now()+HOLD_MS,color:cmd.color||(prev&&prev.color)||null});
      const r=await srvApi('POST','/api/devices/'+encodeURIComponent(id)+'/set',cmd);
      if(!r.ok){ deviceProblem(r); if(prev) HOLDS.set(id,prev); else HOLDS.delete(id); } else { Object.assign(d,cmd); const h=HOLDS.get(id); if(h) h.until=Date.now()+HOLD_MS; }
    }""")
# a second main page, "More", for the alarm, music and other devices; the first page is just lights and cameras
rep("const TABS=['Devices','Automations','Activity','Clock','Sky','Money','Apps','Settings'];","const TABS=['Devices','More','Automations','Activity','Clock','Sky','Money','Apps','Settings'];")
rep("Devices:icoInner('home'),Automations:","Devices:icoInner('home'),More:icoInner('more'),Automations:")
rep('<section data-tab="Automations" hidden>','<section data-tab="More" hidden>\n<h2>More</h2>\n<div id="moreBox"></div>\n</section>\n<section data-tab="Automations" hidden>')
