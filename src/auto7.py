# Lumora 6.2 automations: text/icon/run hooks, wait-between-runs, notify tokens
rep("  return 'something happens';","  return (window.__autoText&&window.__autoText(t.type,t))||'something happens';")
rep("    case 'wait': return 'wait '+a.n+(a.unit==='m'?' min':' sec');","    case 'wait': return 'wait '+a.n+(a.unit==='m'?' min':' sec');\n    case 'sleep': case 'media': return window.__autoText(a.k,a);\n    case 'alarm': return window.__autoText('alarm-act',a);")
rep("  return 'a condition is met';","  return (window.__autoText&&window.__autoText(c.k,c))||'a condition is met';")
rep("    case 'notify': toast(a.text||'Automation'); break;","    case 'notify': toast(String(a.text||'Automation').replace(/\\{light\\}/g,ctx&&ctx.light?nameOf(ctx.light):'a light').replace(/\\{time\\}/g,new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})).replace(/\\{rule\\}/g,ctx&&ctx.rule||'Automation')); break;\n    case 'sleep': case 'media': case 'alarm': await window.__autoAct(a,ctx); break;")
rep("    case 'lighton': { const d=state.find(x=>x.id===c.id); return !!d&&d.online!==false&&(!!d.on===(c.v==='on')); }\n  }\n  return true;","    case 'lighton': { const d=state.find(x=>x.id===c.id); return !!d&&d.online!==false&&(!!d.on===(c.v==='on')); }\n    case 'weekday': case 'anyon': case 'alarmmode': return window.__autoCond(c);\n  }\n  return true;")
# wait between runs
rep("""  <label class="chk"><input type="checkbox" id="bOnce">Run only once, then turn it off</label>""","""  <label class="chk"><input type="checkbox" id="bOnce">Run only once, then turn it off</label>
  <label class="f bcool">Wait at least this long before it can run again (minutes, blank for no wait)<input class="in" id="bCool" type="number" min="1" max="1440" step="1" placeholder="No wait"></label>""")
rep("const newB=()=>({name:'',t:{type:'time'},c:[],acts:[],once:false,editing:null});","const newB=()=>({name:'',t:{type:'time'},c:[],acts:[],once:false,cool:0,editing:null});")
rep("$('bName').value=B.name; $('bOnce').checked=B.once;","$('bName').value=B.name; $('bOnce').checked=B.once; $('bCool').value=B.cool>0?B.cool:'';")
rep("acts:B.acts.map(x=>({...x})),once:$('bOnce').checked};","acts:B.acts.map(x=>({...x})),once:$('bOnce').checked,cool:Math.max(0,Math.min(1440,Math.round(+$('bCool').value)||0))};")
rep("once:!!r.once,editing:r.id};","once:!!r.once,cool:+r.cool>0?+r.cool:0,editing:r.id};")
rep("acts:r.acts,once:!!r.once,last:r.last||null,count:r.count||0};","acts:r.acts,once:!!r.once,cool:+r.cool>0?Math.min(1440,Math.round(+r.cool)):0,last:r.last||null,count:r.count||0};")
rep("  if(ruleBusy.has(r.id)) return;\n  ruleBusy.add(r.id);","  if(!o.force&&+r.cool>0&&r.last&&Date.now()-r.last<Math.min(1440,+r.cool)*60000) return;\n  if(ruleBusy.has(r.id)) return;\n  ruleBusy.add(r.id); ctx.rule=ruleTitle(r);")
rep("(r.once?'Runs once · ':'')+","(r.once?'Runs once · ':'')+(+r.cool>0?'Waits '+r.cool+' min between runs · ':'')+")
# icons
rep("lowbat:'battery',outage:'boltoff',restored:'bolt'","lowbat:'battery',outage:'boltoff',restored:'bolt',interval:'clock',alarm:'shield',sleepstart:'moon',sleepend:'moon'") if False else None
rep("manual:{l:'I tap its button (shows in the left bar)',f:[]}","manual:{l:'I tap its button (shows on the main page)',f:[]}")
rep("The button shows in the left bar.","The button shows on the main page.")
