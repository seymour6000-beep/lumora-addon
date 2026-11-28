import re,urllib.parse
DEFS=('''<defs>
<linearGradient id="k9t" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#4a2a8a"/><stop offset=".5" stop-color="#25124f"/><stop offset="1" stop-color="#0f0724"/></linearGradient>
<linearGradient id="k9e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".4" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>
<radialGradient id="k9g" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#ffb457" stop-opacity=".7"/><stop offset="1" stop-color="#ffb457" stop-opacity="0"/></radialGradient>
<linearGradient id="k9f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe58f"/><stop offset=".42" stop-color="#ff9140"/><stop offset="1" stop-color="#e82f77"/></linearGradient>
<linearGradient id="k9i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf0"/><stop offset="1" stop-color="#ffd25e"/></linearGradient>
<linearGradient id="k9m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a8fb8"/><stop offset=".4" stop-color="#f3eefc"/><stop offset="1" stop-color="#6d6490"/></linearGradient>
</defs>''').replace(chr(10),'')
FLAME='M32 7C33.6 17.5 45.5 23.5 45.5 36.5C45.5 44.8 39.5 50.5 32 50.5C24.5 50.5 18.5 44.8 18.5 36.5C18.5 29.6 22.6 26 25.8 21.4C26.4 24.6 27.8 26.2 29.4 26.8C29.2 19.6 30.4 12.6 32 7Z'
CORE='M32 29C33.8 33.2 38.4 36 38.4 41C38.4 45 35.6 47.6 32 47.6C28.4 47.6 25.6 45 25.6 41C25.6 36.8 30.4 34.6 32 29Z'
def body(sq=False):
    tile=('<rect width="64" height="64" fill="url(#k9t)"/>' if sq else
      '<rect x="1" y="3.5" width="62" height="60" rx="18" fill="#07031a"/><rect x="1" y="1" width="62" height="60" rx="18" fill="url(#k9t)"/><rect x="1.8" y="1.8" width="60.4" height="58.4" rx="17.3" fill="none" stroke="url(#k9e)" stroke-width="1.6"/><path d="M6 20C8 8 18 4 32 4s24 4 26 16C46 14 18 14 6 20z" fill="#fff" fill-opacity=".12"/>')
    return (tile+
     '<circle class="kw-glow" cx="32" cy="34" r="27" fill="url(#k9g)"/>'
     '<g class="kw-flame"><path d="'+FLAME+'" fill="url(#k9f)"/>'
     '<path d="'+FLAME+'" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".7"/>'
     '<path class="kw-core" d="'+CORE+'" fill="url(#k9i)"/></g>'
     '<rect x="30.8" y="50.4" width="2.4" height="5.4" rx="1.2" fill="#f3eefc"/>'
     '<rect x="21" y="55.2" width="22" height="3.8" rx="1.9" fill="url(#k9m)"/>'
     '<ellipse cx="27.4" cy="33" rx="1.8" ry="4.2" fill="#fff" fill-opacity=".55" transform="rotate(14 27.4 33)"/>')
def svg(sq=False,ns=True,w=''):
    return '<svg %sviewBox="0 0 64 64" aria-hidden="true"%s>%s%s</svg>'%('xmlns="http://www.w3.org/2000/svg" ' if ns else '',w,DEFS,body(sq))
open('/tmp/v3/logo.svg','w').write(svg()); open('/tmp/v3/logo_sq.svg','w').write(svg(True))
t=open('/tmp/v3/icons.js').read()
new="const LOGO='"+svg(ns=False).replace("'","\\'")+"';"
t=re.sub(r"const LOGO='.*?';\n",lambda m:new+"\n",t,count=1,flags=re.S)
open('/tmp/v3/icons.js','w').write(t)
open('/tmp/v3/fav.txt','w').write('data:image/svg+xml,'+urllib.parse.quote(svg(),safe="/:=,' "))
