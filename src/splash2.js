
/* ---- Lumora 4.6: "Made by Claude AI" splash, shown after the Lumora splash ---- */
window.__claudeSplash=function(){
  if(document.documentElement.dataset.popout==='1'||document.getElementById('csplash')) return;
  const el=document.createElement('div'); el.id='csplash'; el.setAttribute('role','status'); el.setAttribute('aria-label','Made by Claude AI');
  let rays=''; for(let i=0;i<12;i++){ const a=i*30, long=i%2===0; rays+='<rect x="30.2" y="'+(long?3:9)+'" width="3.6" height="'+(long?20:14)+'" rx="1.8" fill="url(#csr)" transform="rotate('+a+' 32 32)"/>'; }
  el.innerHTML='<div class="csin"><svg class="csmark" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="csr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd9b0"/><stop offset=".55" stop-color="#ff9a6a"/><stop offset="1" stop-color="#c9473a"/></linearGradient><radialGradient id="csc" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff6e8"/><stop offset=".5" stop-color="#ffb07c"/><stop offset="1" stop-color="#b8412f"/></radialGradient><filter id="css" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="1.4"/></filter></defs><g transform="translate(0 2.2)" opacity=".5" filter="url(#css)" fill="#000">'+rays+'</g>'+rays+'<circle cx="32" cy="32" r="7.4" fill="url(#csc)"/><ellipse cx="29.6" cy="28.8" rx="2.6" ry="1.7" fill="#fff" fill-opacity=".7" transform="rotate(-30 29.6 28.8)"/></svg><p class="cst">Made by Claude AI</p><p class="css2">Built and looked after by Claude</p></div>';
  document.body.appendChild(el);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(()=>el.classList.add('out'),reduce?1400:2600); setTimeout(()=>el.remove(),reduce?1900:3300);
};
