
/* ---- Lumora 4: icons dropped into headings, scenes and buttons ---- */
(function(){
  const HEAD={'Lights':'bulb','Other devices':'plug','Cameras':'camera','Usage history':'chart','Activity log':'list','Power events':'bolt','Account':'user','Household':'user','Phone alerts':'bell','Health and backup':'shield','Notifications':'bell','Scenes and testing':'sliders'};
  const SCENE=[[/evening|sunset|dusk/i,'evening'],[/movie|cinema|tv/i,'movie'],[/bright|day|morning|wake/i,'sun'],[/off|night|sleep|bed/i,'power']];
  function decorate(){
    document.querySelectorAll('[data-ico]').forEach(e=>{ if(!e.firstChild) e.innerHTML=ICO(e.dataset.ico); });
    document.querySelectorAll('h2,h3,summary').forEach(h=>{
      if(h.dataset.hic) return; const t=(h.firstChild&&h.firstChild.nodeType===3?h.firstChild.textContent:h.textContent).trim();
      const k=HEAD[t]; if(!k) return; h.dataset.hic='1'; h.classList.add('hic'); h.insertAdjacentHTML('afterbegin',ICO(k,'hico'));
    });
    document.querySelectorAll('#scenes .btn').forEach(b=>{
      if(b.querySelector('.sico')) return; const n=b.textContent.trim(); const m=SCENE.find(x=>x[0].test(n)); const ic=ICO(m?m[1]:'bulb','sico'); b.insertAdjacentHTML('afterbegin',ic);
    });
    const e=document.getElementById('othEmpty'); if(e&&!e.dataset.ic){ e.dataset.ic='1'; e.insertAdjacentHTML('afterbegin','<span class="emptyic">'+ICO('plug')+'</span>'); }
    document.querySelectorAll('.nclear').forEach(n=>{ if(!n.querySelector('.emptyic')) n.insertAdjacentHTML('afterbegin','<span class="emptyic ok">'+ICO('check')+'</span>'); });
  }
  const mo=new MutationObserver(()=>{ clearTimeout(decorate.t); decorate.t=setTimeout(decorate,60); });
  const go=()=>{ decorate(); mo.observe(document.body,{childList:true,subtree:true}); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
  /* favouriting a light pops the star */
  document.addEventListener('click',e=>{ const s=e.target.closest&&e.target.closest('.lt .star'); if(!s) return; s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); },true);
})();
