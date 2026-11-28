/* more backgrounds */
const BGN=(()=>{
  const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
  const blobs=(el,n,cols,minS,maxS,blur)=>{ for(let i=0;i<n;i++){ const s=document.createElement('i'), z=rnd(minS,maxS); s.style.cssText='left:'+rnd(-5,90).toFixed(0)+'%;top:'+rnd(-5,85).toFixed(0)+'%;width:'+z.toFixed(0)+'px;height:'+z.toFixed(0)+'px;background:'+cols[i%cols.length]+';animation-delay:-'+rnd(0,12).toFixed(1)+'s;animation-duration:'+rnd(14,30).toFixed(0)+'s'+(blur?';filter:blur('+blur+'px)':''); el.appendChild(s); } };
  const wave=(c,o)=>'<svg viewBox="0 0 2880 300" preserveAspectRatio="none" aria-hidden="true"><path fill="'+c+'" opacity="'+o+'" d="M0 150 Q180 50 360 150 T720 150 T1080 150 T1440 150 T1800 150 T2160 150 T2520 150 T2880 150 V300 H0Z"/></svg>';
  const css={
    nebula:el=>{ el.className='bgx-nebula'; el.innerHTML='<i></i><i></i><i></i>'; },
    sunset:el=>{ el.className='bgx-sunset'; },
    ocean:el=>{ el.className='bgx-ocean'; el.innerHTML=wave('#2f8cff','.28')+wave('#2fe6d0','.22')+wave('#6a8dff','.3'); },
    synth:el=>{ el.className='bgx-synth'; },
    bokeh:el=>{ el.className='bgx-bokeh'; blobs(el,16,['#ffd36a','#ff8fd0','#7ab8ff','#7affc9','var(--accent)'],50,170,2); },
    lava:el=>{ el.className='bgx-lava'; blobs(el,6,['#ff5a8a','#ff9a4d','#ffd36a'],200,380,0); },
    mesh:el=>{ el.className='bgx-mesh'; },
    hex:el=>{ el.className='bgx-hex'; el.innerHTML='<svg aria-hidden="true"><defs><pattern id="hxp" width="28" height="49" patternUnits="userSpaceOnUse"><path fill="currentColor" fill-rule="evenodd" d="M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.3l-11-6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31l-11 6.35V49h-2z"/></pattern></defs><rect width="100%" height="100%" fill="url(#hxp)"/></svg>'; },
    circuit:el=>{ el.className='bgx-circuit'; let p='',n=''; for(let i=0;i<46;i++){ let x=Math.round(rnd(0,1400)/20)*20, y=Math.round(rnd(0,900)/20)*20, d='M'+x+' '+y; for(let k=0;k<4;k++){ const l=Math.round(rnd(2,8))*20, dir=Math.floor(Math.random()*3); if(dir===0){ x+=l; d+=' h'+l; } else if(dir===1){ y+=l; d+=' v'+l; } else { x+=l*.7; y+=l*.7; d+=' l'+(l*.7)+' '+(l*.7); } } p+='<path d="'+d+'"/>'; n+='<circle cx="'+x+'" cy="'+y+'" r="5"/>'; } el.innerHTML='<svg viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+p+n+'</svg>'; },
    blue:el=>{ el.className='bgx-blue'; },
    grain:el=>{ el.className='bgx-grain'; el.innerHTML='<svg aria-hidden="true"><filter id="grn"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .55 0 0 0 0 .55 0 0 0 0 .55 0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#grn)"/></svg>'; },
    city:el=>{ el.className='bgx-city'; let x=0,s='',w=''; while(x<1400){ const bw=rnd(50,120), bh=rnd(140,420); s+='<rect x="'+x.toFixed(0)+'" y="'+(600-bh).toFixed(0)+'" width="'+bw.toFixed(0)+'" height="'+bh.toFixed(0)+'"/>'; for(let wy=600-bh+14;wy<584;wy+=26) for(let wx=x+9;wx<x+bw-14;wx+=20) if(Math.random()<.28) w+='<rect class="w" style="animation-delay:-'+rnd(0,5).toFixed(1)+'s" x="'+wx.toFixed(0)+'" y="'+wy.toFixed(0)+'" width="8" height="12"/>'; x+=bw+rnd(2,12); } el.innerHTML='<svg viewBox="0 0 1400 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g style="fill:color-mix(in srgb,var(--ink) 16%,var(--bg))">'+s+'</g><g fill="#ffd36a" opacity=".7">'+w+'</g></svg>'; },
    mount:el=>{ el.className='bgx-mount'; const ridge=(base,amp,seed)=>{ let d='M0 600 L0 '+base; for(let x=0;x<=1400;x+=70) d+=' L'+x+' '+(base-Math.abs(Math.sin(x*seed+seed*9))*amp-rnd(0,amp*.25)).toFixed(0); return d+' L1400 600Z'; }; el.innerHTML='<svg viewBox="0 0 1400 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" style="color:var(--ink)"><path fill="currentColor" opacity=".10" d="'+ridge(300,220,.011)+'"/><path fill="currentColor" opacity=".16" d="'+ridge(380,170,.017)+'"/><path fill="currentColor" opacity=".26" d="'+ridge(460,120,.023)+'"/></svg>'; },
    stripes:el=>{ el.className='bgx-stripes'; },
    spot:el=>{ el.className='bgx-spot'; },
    plasma:el=>{ el.className='bgx-plasma'; },
    prism:el=>{ el.className='bgx-prism'; },
    checker:el=>{ el.className='bgx-checker'; },
    glassgrid:el=>{ el.className='bgx-glassgrid'; },
    carbon:el=>{ el.className='bgx-carbon'; },
    deepsea:el=>{ el.className='bgx-deepsea'; el.innerHTML='<i></i><i></i><i></i><i></i>'; },
    marble:el=>{ el.className='bgx-marble'; el.innerHTML='<svg aria-hidden="true"><defs><filter id="mbl" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".004 .007" numOctaves="5" seed="'+Math.floor(rnd(1,90))+'"/><feColorMatrix values="0 0 0 0 .82  0 0 0 0 .86  0 0 0 0 1  1 0 0 0 0"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 .1 .55 1 .55 .1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer><feGaussianBlur stdDeviation=".7"/></filter></defs><rect width="100%" height="100%" filter="url(#mbl)"/></svg>'; },
    galaxy:el=>{ el.className='bgx-galaxy'; el.innerHTML='<i></i><i></i>'; },
    ripples:el=>{ el.className='bgx-ripples'; el.innerHTML='<i></i><i></i><i></i><i></i>'; }
  };
  const canvas=['fireflies','embers','digital','bubbles','warp'];
  const init=(k,W,H)=>{ const n=innerWidth<700?.6:1, a=[]; const N=c=>Math.round(c*n);
    if(k==='fireflies') for(let i=0;i<N(55);i++) a.push({x:rnd(0,W),y:rnd(0,H),vx:rnd(-12,12),vy:rnd(-10,10),ph:rnd(0,6.28),r:rnd(1.5,3.2)});
    else if(k==='embers') for(let i=0;i<N(70);i++) a.push({x:rnd(0,W),y:rnd(0,H),vy:rnd(25,80),dr:rnd(-14,14),ph:rnd(0,6.28),r:rnd(1,3)});
    else if(k==='digital') for(let i=0;i<Math.floor(W/22);i++) a.push({x:i*22+4,y:rnd(-H,H),v:rnd(60,160),c:Math.floor(rnd(6,16))});
    else if(k==='bubbles') for(let i=0;i<N(40);i++) a.push({x:rnd(0,W),y:rnd(0,H),v:rnd(18,60),r:rnd(5,28),ph:rnd(0,6.28)});
    else if(k==='warp') for(let i=0;i<N(180);i++) a.push({x:rnd(-1,1),y:rnd(-1,1),z:rnd(.1,1)});
    return a; };
  const draw={
    fireflies:(c,p,t,dt,W,H,col)=>{ for(const f of p){ f.x+=(f.vx+Math.sin(t/1500+f.ph)*8)*dt; f.y+=(f.vy+Math.cos(t/1700+f.ph)*8)*dt; if(f.x<0)f.x=W; if(f.x>W)f.x=0; if(f.y<0)f.y=H; if(f.y>H)f.y=0; const a=.25+.75*Math.max(0,Math.sin(t/900+f.ph)); const g=c.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r*7); g.addColorStop(0,'rgba(255,235,120,'+(a*.9)+')'); g.addColorStop(1,'rgba(255,235,120,0)'); c.fillStyle=g; c.beginPath(); c.arc(f.x,f.y,f.r*7,0,6.283); c.fill(); } },
    embers:(c,p,t,dt,W,H)=>{ for(const e of p){ e.y-=e.vy*dt; e.x+=(e.dr+Math.sin(t/800+e.ph)*14)*dt; if(e.y<-6){ e.y=H+6; e.x=rnd(0,W); } const a=Math.min(1,e.y/(H*.7)); c.fillStyle='rgba('+(255)+','+Math.round(120+90*a)+',60,'+(.15+.7*a)+')'; c.beginPath(); c.arc(e.x,e.y,e.r,0,6.283); c.fill(); } },
    digital:(c,p,t,dt,W,H,col)=>{ c.font='16px ui-monospace,Menlo,Consolas,monospace'; c.fillStyle=col; for(const d of p){ d.y+=d.v*dt; if(d.y-d.c*18>H){ d.y=rnd(-200,0); d.v=rnd(60,160); } for(let i=0;i<d.c;i++){ c.globalAlpha=Math.max(0,.55*(1-i/d.c)); c.fillText(String.fromCharCode(0x30A0+Math.floor((t/90+d.x*7+i*13)%96)),d.x,d.y-i*18); } } c.globalAlpha=1; },
    bubbles:(c,p,t,dt,W,H,col)=>{ c.strokeStyle=col; c.lineWidth=1.5; for(const b of p){ b.y-=b.v*dt; b.x+=Math.sin(t/1200+b.ph)*10*dt; if(b.y<-b.r){ b.y=H+b.r; b.x=rnd(0,W); } c.globalAlpha=.35; c.beginPath(); c.arc(b.x,b.y,b.r,0,6.283); c.stroke(); c.globalAlpha=.18; c.beginPath(); c.arc(b.x-b.r*.3,b.y-b.r*.3,b.r*.25,0,6.283); c.fillStyle=col; c.fill(); } c.globalAlpha=1; },
    warp:(c,p,t,dt,W,H,col)=>{ c.strokeStyle=col; for(const s of p){ s.z-=dt*.22; if(s.z<=.02){ s.x=rnd(-1,1); s.y=rnd(-1,1); s.z=1; } const k=1/s.z, x=W/2+s.x*k*W*.12, y=H/2+s.y*k*W*.12, k2=1/(s.z+.05), x2=W/2+s.x*k2*W*.12, y2=H/2+s.y*k2*W*.12; c.globalAlpha=Math.min(.8,(1-s.z)*1.2); c.lineWidth=Math.max(.6,(1-s.z)*2.2); c.beginPath(); c.moveTo(x2,y2); c.lineTo(x,y); c.stroke(); } c.globalAlpha=1; }
  };
  /* the spotlight follows the pointer */
  let raf=0; addEventListener('pointermove',e=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; const s=document.querySelector('.bgx-spot'); if(s){ s.style.setProperty('--mx',(e.clientX/innerWidth*100).toFixed(1)+'%'); s.style.setProperty('--my',(e.clientY/innerHeight*100).toFixed(1)+'%'); } }); },{passive:true});
  return {css,canvas,init,draw};
})();
