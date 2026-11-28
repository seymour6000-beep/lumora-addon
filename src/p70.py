# Lumora 7: delete every old style and ship the new design system (plus the background effects and the seasonal skins, which are features)
import re as _re
_i=s.index('<style>'); _j=s.index('</style>')
_keep=open('/tmp/v3/bg.css').read()+open('/tmp/v3/xmas.css').read()
s=s[:_i]+'<style>'+open('/tmp/v3/v7/core.css').read()+_keep+open('/tmp/v3/v7/v7.css').read()+s[_j:]
# 8.1.2: cameras are removed from the app
s=s.replace("const MAX_LIGHTS=30, MAX_CAMS=30;","const MAX_LIGHTS=30, MAX_CAMS=0;",1)
s=s.replace("if(Array.isArray(sc)) cams=sc.filter(c=>c&&c.id&&c.name); else if(REMOTE) cams=[];","cams=[];",1)
s=s.replace('placeholder="Search lights and cameras"','placeholder="Search lights"').replace("Search lights and cameras","Search lights")
s=s.replace("Devices and cameras","Devices and sensors").replace("Sensors, locks, cameras and power cuts","Sensors, locks and power cuts")
s=s.replace("Your lights and cameras, in one place.","Your lights, in one place.")
