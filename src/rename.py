import re as _re
NEWNAME='Kindlewick'
_keep=['Lumora all off','start with <b>Lumora</b>','<b>Lumora</b> scenes','X-Lumora','Lumora-TV','Lumora-Setup','lumora-addon']
_ph={k:'\x00%d\x00'%i for i,k in enumerate(_keep)}
for k,v in _ph.items(): s=s.replace(k,v)
s=_re.sub(r'Lumora(?! [0-9])',NEWNAME,s)
for k,v in _ph.items(): s=s.replace(v,k)
