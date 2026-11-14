import subprocess, sys, time, re, os
LOG=os.environ.get('SR','/tmp/sr')+'/orca.log'
def speech(frm):
    txt=open(LOG).read()[frm:]
    return [re.sub(r" \{'established.*$","",l.split('SPEECH OUTPUT: ',1)[1]).strip("'") for l in txt.split('\n') if 'SPEECH OUTPUT' in l]
def key(k): subprocess.run(['xdotool','key',k], env=os.environ); time.sleep(0.8)
def say(label, keys):
    frm=os.path.getsize(LOG)
    for k in keys:
        if k=='CLICK': subprocess.run(['xdotool','mousemove','1270','450','click','1'], env=os.environ); time.sleep(0.8)
        elif k.startswith('wait'): time.sleep(float(k[4:]))
        else: key(k)
    time.sleep(1.4)
    out=[o for o in speech(frm) if o not in ('tab','return','space','escape','shift+tab','shift tab')]
    print(f'\n> {label}   [{" ".join(keys)}]')
    for o in (out or ['(nothing spoken)']): print('   Orca:', o)
    return out
def tabto(label, needle, limit=14, back=False):
    """Tab (or Shift+Tab) until Orca says something containing `needle`."""
    heard=[]
    for i in range(limit):
        frm=os.path.getsize(LOG)
        key('shift+Tab' if back else 'Tab'); time.sleep(1.1)
        out=[o for o in speech(frm) if o not in ('tab','return','space','escape','shift+tab','shift tab')]
        heard.append(out)
        if any(needle.lower() in o.lower() for o in out):
            print(f'\n> {label}   [{"Shift+Tab" if back else "Tab"} x{i+1} until it says "{needle}"]')
            for step in heard[-3:]:
                for o in step: print('   Orca:', o)
            return True
    print(f'\n> {label}   NOT FOUND after {limit} presses; last heard: {heard[-1]}')
    return False
