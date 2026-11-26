const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{ const b=await chromium.launch(); const sq=fs.readFileSync('/tmp/v3/logo_sq.svg','utf8');
 for(const [name,size] of [['icon-512',512],['icon-192',192],['apple-touch-icon',180]]){
  const p=await b.newPage({viewport:{width:size,height:size}}); await p.setContent('<body style="margin:0">'+sq.replace('<svg ','<svg width="'+size+'" height="'+size+'" ')+'</body>'); await p.screenshot({path:'/tmp/v3/'+name+'.png',clip:{x:0,y:0,width:size,height:size}}); await p.close(); }
 await b.close(); })();
