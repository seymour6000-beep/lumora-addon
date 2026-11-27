/* Lumora 6.2.1: full screen button and an Exit button that is always there while in full screen */
(function(){
  if(document.documentElement.dataset.popout==='1') return;
  const de=document.documentElement, D=window.lumoraDesktop;
  const canApi=!!(de.requestFullscreen||de.webkitRequestFullscreen);
  const touch=matchMedia('(pointer:coarse)').matches;
  const apiFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
  const isFs=()=>apiFs()||matchMedia('(display-mode: fullscreen)').matches||(!touch&&screen.height>600&&innerHeight>=screen.height-1&&innerWidth>=screen.width-1);
  async function enter(){ try{ await (de.requestFullscreen?de.requestFullscreen():de.webkitRequestFullscreen()); }catch(e){ toast('This browser would not go full screen. Try F11.'); } }
  async function leave(){
    if(apiFs()){ try{ await (document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen()); }catch(e){} return; }
    if(D&&D.exitFullscreen){ D.exitFullscreen(); return; }
    toast('Press F11 to leave full screen.');
  }
  const mk=(id,label,ic)=>{ const b=document.createElement('button'); b.id=id; b.type='button'; b.setAttribute('aria-label',label); b.title=label; b.innerHTML=ICO(ic); document.body.appendChild(b); return b; };
  const btn=canApi?mk('fsBtn','Full screen','expand'):null;
  const ex=document.createElement('button'); ex.id='fsExit'; ex.type='button'; ex.hidden=true; ex.innerHTML=ICO('shrink')+'<span>Exit full screen</span>'; ex.setAttribute('aria-label','Exit full screen'); document.body.appendChild(ex);
  let idle=null;
  const wake=()=>{ ex.classList.remove('idle'); clearTimeout(idle); idle=setTimeout(()=>ex.classList.add('idle'),3500); };
  function sync(){
    const f=isFs(); const was=!ex.hidden; ex.hidden=!f; de.dataset.fs=f?'1':'';
    if(btn){ btn.innerHTML=ICO(f?'shrink':'expand'); const l=f?'Exit full screen':'Full screen'; btn.title=l; btn.setAttribute('aria-label',l); }
    if(f&&!was) wake();
  }
  if(btn) btn.onclick=()=>isFs()?leave():enter();
  ex.onclick=leave;
  ['mousemove','touchstart','keydown','pointerdown'].forEach(e=>addEventListener(e,()=>{ if(!ex.hidden) wake(); },{passive:true}));
  document.addEventListener('fullscreenchange',sync); document.addEventListener('webkitfullscreenchange',sync); addEventListener('resize',sync);
  setInterval(sync,1500); sync();
  window.__fullscreen={isFs,enter,leave};
})();
