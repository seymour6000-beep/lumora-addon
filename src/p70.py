# Lumora 7: delete every old style and ship the new design system (plus the background effects and the seasonal skins, which are features)
import re as _re
_i=s.index('<style>'); _j=s.index('</style>')
_keep=open('/tmp/v3/bg.css').read()+open('/tmp/v3/xmas.css').read()
s=s[:_i]+'<style>'+open('/tmp/v3/v7/core.css').read()+_keep+open('/tmp/v3/v7/v7.css').read()+s[_j:]
