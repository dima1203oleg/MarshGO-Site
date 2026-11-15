import json,sys
t=json.load(open(__file__.replace('check-contrast.py','DESIGN_TOKENS.json')))['color']
def L(h):
    c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    c=[x/12.92 if x<=.03928 else ((x+.055)/1.055)**2.4 for x in c]
    return .2126*c[0]+.7152*c[1]+.0722*c[2]
def cr(a,b):
    x,y=sorted((L(a),L(b)),reverse=True); return (x+.05)/(y+.05)
pairs=[("ink","canvas",4.5),("ink","surface",4.5),("ink","surfaceRaised",4.5),("inkSecondary","canvas",4.5),("inkSecondary","surface",4.5),("inkSecondary","surfaceRaised",4.5),("onBrandAction","brandAction",4.5),("brandAction","surface",4.5),("brandAction","brandTint",4.5),("success","surface",4.5),("warning","surface",4.5),("danger","surface",4.5),("focusRing","surface",3),("focusRing","canvas",3),("border","surface",1.0),("routeSelected","canvas",3)]
bad=0
for th in("light","dark"):
    for f,b,m in pairs:
        r=cr(t[f][th],t[b][th]); ok=r>=m; bad+=not ok
        print(f"{th:5} {f:14}/{b:13} {r:5.2f} (>= {m}) {'PASS' if ok else 'FAIL'}")
sys.exit(1 if bad else 0)
