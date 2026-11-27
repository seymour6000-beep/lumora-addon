import re,sys
def prefix(css):
    out=[]; i=0
    css=re.sub(r'/\*.*?\*/','',css,flags=re.S)
    def block(s):
        res=[]; i=0; n=len(s)
        while i<n:
            j=s.find('{',i)
            if j<0: break
            head=s[i:j].strip()
            depth=1;k=j+1
            while k<n and depth:
                if s[k]=='{': depth+=1
                elif s[k]=='}': depth-=1
                k+=1
            body=s[j+1:k-1]
            if head.startswith('@media') or head.startswith('@supports'):
                res.append(head+'{'+block(body)+'}')
            elif head.startswith('@'):
                res.append(head+'{'+body+'}')
            else:
                sels=[]
                for sel in split_top(head):
                    sel=sel.strip()
                    if not sel: continue
                    if sel.startswith(':root'): sels.append(':root:root:root'+sel[5:])
                    elif sel.startswith('html') : sels.append(':root:root:root'+sel[4:])
                    elif sel.startswith('body'): sels.append(':root:root:root '+sel)
                    else: sels.append(':root:root:root '+sel)
                res.append(','.join(sels)+'{'+body+'}')
            i=k
        return ''.join(res)
    def split_top(h):
        parts=[];d=0;cur=''
        for ch in h:
            if ch in '([': d+=1
            if ch in ')]': d-=1
            if ch==',' and d==0: parts.append(cur);cur=''
            else: cur+=ch
        parts.append(cur); return parts
    return block(css)
if __name__=='__main__':
    src=''.join(open('/tmp/v3/v7/'+f).read()+'\n' for f in sys.argv[1:])
    import re as _r
    src=_r.sub(r'/\*.*?\*/','',src,flags=_r.S); src=_r.sub(r'\s+',' ',src)
    open('/tmp/v3/v7/v7.css','w').write(src)
