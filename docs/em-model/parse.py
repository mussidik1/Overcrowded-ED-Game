import re, json, sys
lines=open('/tmp/emm.txt').read().split('\n')
start=next(i for i,l in enumerate(lines) if re.match(r'\s*1\.0\s+SIGNS, SYMPTOMS',l))
end=next(i for i,l in enumerate(lines) if re.match(r'\s*19\.0 PROCEDURES',l))
cols=None; out=[]; sect=None; pend=None
code_re=re.compile(r'^\s*(\d{1,2}(?:\.\d{1,2})+)\s+(.*)$')
for l in lines[start:end+400]:
    if 'Critical' in l and 'Emergent' in l:
        cols=[l.index('Critical')+4,l.index('Emergent')+4,l.index('Lower')+5]; continue
    m=re.match(r'^\s*(\d{1,2})\.0\s+([A-Z].*)$',l)
    if m: sect=(int(m.group(1)),m.group(2).strip()); continue
    m=code_re.match(l)
    if not m:
        if pend and l.strip() and not l.strip().startswith('Model of') and not l.strip().startswith('Page') and 'X' not in l.split()[:1]:
            t=re.split(r'\s{2,}X',l)[0].strip()
            if t and not re.match(r'^[X\s]+$',t): pend['name']+=' '+t
        continue
    code,rest=m.group(1),m.group(2)
    xs=[mm.start()+len(l)-len(l) for mm in re.finditer(r'\bX\b',l)]
    name=re.split(r'\s{2,}X\b|\s+X(\s|$)',rest)[0].strip()
    flags=[]
    for x in xs:
        if cols:
            d=[abs(x-c) for c in cols]; flags.append('CEL'[d.index(min(d))])
    it={'code':code,'name':name,'sys':sect[0] if sect else None,'sysname':sect[1] if sect else None,'acuity':''.join(sorted(set(flags),key='CEL'.index)),'nx':len(xs)}
    out.append(it); pend=it
json.dump(out,open('/tmp/emm/items.json','w'),indent=0)
print(len(out))
from collections import Counter
print(Counter(i['sys'] for i in out))
