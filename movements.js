/* Movements page (F-084, v0.7.x). Flat map of Jewish movement, built on the globe's own styles, controls and card standard.
   Data: data/history.json "sheet" (Movements, Events cards, Places, Eras). Nothing here is written back.
   Rules (CEO, Oct 13): the story starts at the first exile (722 BCE); return and aliyah routes are not shown; the camera follows the action and
   never zooms in past a recognisable region; touching the map, Previous, Next, the slider or a filter stops Play; tapping an arrow opens that journey.
   One card per event; a route or destination chip opens its branch card (event title stays, subhead names the destination).
   A parent row (Barbados, New Amsterdam) lights its leg rows. Only approved cards show (add ?drafts=1 to preview drafts). */
(function(){
'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const DRAFTS=/[?&]drafts=1\b/.test(location.search);
const FIRST_YEAR=-722;                     // the Assyrian exile of the Northern Kingdom: the first exile in the data
const COLORS={Red:'#B8352B',Blue:'#2D6CB8',Charcoal:'#41464A'};   // same fills as the globe
const OUTLINE='#FFF2DE',TRAD='#EFE6D3';
/* The five accepted eras shown on the slider and in the Era filter. Boundaries follow the Sheet's seven data eras (Biblical = era 1; Ancient History = eras 2 and 3; Middle Ages = eras 4 and 5; Early Modern History = era 6, Modern History = era 7), and Contemporary History starts at 1898 (ERA-8), the year after the First Zionist Congress. v0.7.5 reads these names and start years from the Sheet; this list is the fallback. */
const HEAD=[{era:1,name:'Biblical',startYear:-2000},{era:2,name:'Ancient History',startYear:-586},{era:3,name:'Middle Ages',startYear:200},{era:4,name:'Early Modern History',startYear:1492},{era:5,name:'Modern History',startYear:1700},{era:6,name:'Contemporary History',startYear:1898}];
const GAPSEC=1.8;   // a stretch of years with no journeys on screen takes about this long at 1x
/* Cause: five headings. Persistent flight joins Persecution; Relocation stays its own heading (CEO Oct 13); returns are not shown at all. */
const CAUSE_OF={'expulsion':'Expulsion','persecution-driven flight':'Persecution','persistent flight':'Persecution','deportation':'Deportation','voluntary migration':'Voluntary migration','relocation':'Relocation'};
const CAUSES=['Deportation','Expulsion','Persecution','Relocation','Voluntary migration'];
const HOLD=15,FADE=6,RATE=30;              // years a route stays bright after it ends, years to fade in, years per second at 1x
const ICO_PLAY='M3.5,1.5 L13.5,8 L3.5,14.5 Z',ICO_PAUSE='M3.5,1.5 H6.5 V14.5 H3.5 Z M9.5,1.5 H12.5 V14.5 H9.5 Z';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bare=s=>typeof s!=='string'?s:(/\bBCE\b/.test(s)?s:s.replace(/\s+CE\b/g,''));   // project rule: bare Common Era years
const yearLabel=y=>y<0?`${-Math.round(y)} BCE`:String(Math.round(y));
const shortName=p=>p?.mapLabel?String(p.mapLabel):String(p?.historicalName||'').split(/ \/ | \(/)[0];   // v0.7.5: the Sheet's Map label wins; blank means the Historical name
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

let DATA=null,PL=new Map(),CARDS=new Map(),ERAS=HEAD,DETAIL=[],ROUTES=[],EVENTS=new Map(),MINY=0,MAXY=1;
let W=0,H=0,V={lon:20,lat:38,degW:100},HOME=null;
const PREVIEW=(()=>{try{const x=/[?&]nav=(glass|old)\b/.exec(location.search);if(x)sessionStorage.setItem('ojj-nav',x[1]);return sessionStorage.getItem('ojj-nav')!=='old';}catch(e){return !/[?&]nav=old\b/.test(location.search);}})();   // v0.8.0 preview flag, see app.js
let zT=0,Y=0,playing=false,speed=1,lastT=0,auto=true,lastKey='';
const F={era:null,cause:null,trails:false};   // Group, From and To filters are suppressed for now (roadmap F-088)
let EVSYM=new Map();
let SEL=null;                               // {ev:eventKey, id:routeId|null, parent:parentId|null}
let anim=null,raf=0,drag=null,moved=false,followT=0;
const phone=()=>matchMedia('(max-width:620px) and (orientation:portrait)').matches;
const MIN_DEG=()=>phone()?46:34;            // never zoom in further than this width in degrees: a region stays recognisable

/* ---------- data ---------- */
/* v0.7.5: the six headline eras come from the Sheet (Eras column Q, Headline era): each name starts where its first data era starts. If the Sheet has no Headline era column the built-in list above is used. */
function headlineEras(rows){
  const hs=(rows||[]).filter(e=>e.headline&&Number.isFinite(e.startYear)).sort((a,b)=>a.startYear-b.startYear),by=new Map();
  for(const e of hs)if(!by.has(e.headline))by.set(e.headline,{name:e.headline,startYear:e.startYear});
  return by.size?[...by.values()].map((x,i)=>({era:i+1,...x})):HEAD;
}
function build(){
  const S=DATA.sheet;PL=new Map(S.places.map(p=>[p.id,p]));CARDS=new Map(S.cards.map(c=>[c.id,c]));
  EVSYM=new Map((S.events||[]).filter(e=>e.mapSymbol&&SYM_SVG[e.mapSymbol.kind]&&(e.mapSymbol.status==='locked'||DRAFTS)).map(e=>[e.id,e.mapSymbol.kind]));   // F-082: events that have a map symbol
  DETAIL=(S.eras||[]).slice().sort((a,b)=>a.startYear-b.startYear);
  ERAS=headlineEras(S.eras);
  const eraOf=y=>{let e=null;for(const x of ERAS)if(x.startYear<=y)e=x;return e?e.era:null;};
  const ok=m=>m.arrowEndsReady&&[m.originPlaceId,m.destinationPlaceId].every(id=>Number.isFinite(PL.get(id)?.lat)&&Number.isFinite(PL.get(id)?.lon));
  let rows=S.movements.filter(m=>ok(m)&&m.character!=='return/aliyah'&&m.startYear>=FIRST_YEAR);
  const have=new Set(rows.map(m=>m.id));
  rows=rows.filter(m=>m.id!=='MOV-055'||['MOV-052','MOV-053','MOV-054'].every(x=>have.has(x)));   // branch rule from the Dataset chat
  const sib=new Map();
  // v0.8.0 (F-097, CEO 10/14): a contested route has no separate line style and no Key entry; it is drawn like any route, in the colour of its cause.
  // Only a "Dotted (traditional)" route keeps the dotted Biblical/Traditional look.
  const CAUSE_COLOUR=ch=>['expulsion','deportation','persecution-driven flight','persistent flight'].includes(ch)?'Red':ch==='return/aliyah'?'Blue':'Charcoal';
  ROUTES=rows.map(m=>{const t=m.arrowTreatment||'',contested=/^Dotted.*contested/i.test(t),c=/^Red/.test(t)?'Red':/^Blue/.test(t)?'Blue':PREVIEW&&contested?CAUSE_COLOUR(m.character):'Charcoal';
    return {id:m.id,ev:m.eventId||m.id,m,a:PL.get(m.originPlaceId),b:PL.get(m.destinationPlaceId),start:m.startYear,end:m.endYear??m.startYear,
      color:COLORS[c],cname:c,dotted:/^Dotted/i.test(t)&&!(PREVIEW&&contested),cause:CAUSE_OF[m.character]||'',era:eraOf(m.startYear)};});
  for(const r of ROUTES){const k=r.ev+'|'+r.m.originPlaceId;(sib.get(k)||sib.set(k,[]).get(k)).push(r);}
  for(const g of sib.values())g.forEach((r,i)=>{r.bend=g.length>1?(i-(g.length-1)/2)*0.22:0.12;});
  EVENTS=new Map();
  for(const r of ROUTES){let e=EVENTS.get(r.ev);if(!e){const c=CARDS.get(r.ev);e={key:r.ev,card:c&&(c.status==='approved'||DRAFTS)?c:null,routes:[]};EVENTS.set(r.ev,e);}e.routes.push(r);}
  for(const e of EVENTS.values()){e.routes.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
    e.title=e.card?.title||`${shortName(e.routes[0].a)} to ${shortName(e.routes[0].b)}`;e.start=e.card?.startYear??e.routes[0].start;}
  /* Parent rows (no arrow of their own, e.g. MOV-054 Barbados, MOV-055 New Amsterdam): their route is the leg rows that list them in Linked records,
     plus any earlier leg that ends where a leg begins. Tapping the parent chip lights all legs. */
  for(const m of S.movements){
    if(m.arrowEndsReady||!m.branch||!m.eventId)continue;const e=EVENTS.get(m.eventId);if(!e)continue;
    const legs=new Set(e.routes.filter(r=>(r.m.links||[]).includes(m.id)).map(r=>r.id));if(!legs.size)continue;
    for(const id of [...legs]){let L=route(id),guard=0;while(L&&L.m.originPlaceId!==m.originPlaceId&&guard++<6){const X=e.routes.find(x=>x.m.destinationPlaceId===L.m.originPlaceId&&x.start<=L.start&&!legs.has(x.id));if(!X)break;legs.add(X.id);L=X;}}
    (e.parents||(e.parents=[])).push({id:m.id,m,legs,label:m.destination});
  }
  MINY=Math.min(...ROUTES.map(r=>r.start));MAXY=Math.max(...ROUTES.map(r=>r.end));buildGaps();
}
const route=id=>ROUTES.find(r=>r.id===id);
const pass=r=>(F.era==null||r.era===F.era)&&(!F.cause||r.cause===F.cause);
function strength(r){
  if(Y<r.start)return null;
  if(Y<=r.end+HOLD)return {o:Math.min(1,(Y-r.start+1)/FADE),active:true};
  return F.trails?{o:.3,active:false}:null;
}

/* ---------- view ---------- */
const scale=()=>W/V.degW;   // pixels per degree of longitude at the equator
/* v0.8.x flat-map projection: Natural Earth (rounder than the plain lon/lat grid). nProj goes lon/lat to map units, nInv comes back. The map image images/map-ne.jpg is drawn in the same units. */
const D2R=Math.PI/180,NE_XM=2.735384723480633,NE_YM=1.422390506730596,NE_K=180/Math.PI/0.8707,NE_MAXK=2*NE_YM*NE_K;
const neF=lat=>{const p=lat*D2R,p2=p*p,p4=p2*p2;return 0.8707-0.131979*p2+p4*(-0.013791+p4*(0.003971*p2-0.001529*p4));};
const neY=lat=>{const p=lat*D2R,p2=p*p,p4=p2*p2;return p*(1.007226+p2*(0.015085+p4*(-0.044475+0.028874*p2-0.005916*p4)));};
const nProj=(lon,lat)=>[lon*D2R*neF(lat),neY(lat)];
function nInv(x,y){let p=y/1.007226;for(let i=0;i<7;i++){const p2=p*p,p6=p2*p2*p2,p7=p6*p,p9=p7*p2,p11=p9*p2,f=1.007226*p+0.015085*p2*p-0.044475*p7+0.028874*p9-0.005916*p11-y,d=1.007226+3*0.015085*p2-7*0.044475*p6+9*0.028874*p6*p2-11*0.005916*p6*p2*p2;p=clamp(p-f/d,-Math.PI/2,Math.PI/2);}
  const lat=p/D2R;return [x/neF(lat)/D2R,lat];}
const NEF=()=>scale()*NE_K;   // pixels per map unit
const px=(lon,lat)=>{const F=NEF(),c=nProj(V.lon,V.lat),q=nProj(lon,lat);return [(q[0]-c[0])*F+W/2,(c[1]-q[1])*F+H/2];};
/* keep the map point under a finger or cursor fixed while the zoom changes */
const anchorAt=(x,y)=>{const F=NEF(),c=nProj(V.lon,V.lat);return nInv(c[0]+(x-W/2)/F,c[1]-(y-H/2)/F);};
function placeAnchor(a,x,y){const F=NEF(),q=nProj(a[0],a[1]),c=nInv(q[0]-(x-W/2)/F,q[1]+(y-H/2)/F);V.lon=c[0];V.lat=c[1];}
function clampView(){
  const maxDeg=Math.min(360,NE_MAXK*W/H);V.degW=clamp(V.degW,MIN_DEG(),Math.max(MIN_DEG(),maxDeg));
  const hh=H/2/NEF(),lo=-NE_YM+hh,hi=NE_YM-hh;{const c=nProj(V.lon,V.lat),yy=lo>hi?0:clamp(c[1],lo,hi);if(yy!==c[1]){const r=nInv(c[0],yy);V.lon=r[0];V.lat=r[1];}}V.lon=clamp(V.lon,-180,180);   // when the height limit bites, the sideways position is kept
}
function size(){const w=$('mapWrap');W=w.clientWidth;H=w.clientHeight;}
function homeView(){const p=phone();return {lon:p?10:22,lat:p?40:38,degW:(p?60:Math.min(100,Math.max(60,W/9)))*1.15};}   // 15% wider than before, so the map reads as a map
function setView(v,ms){
  cancelAnimationFrame(anim?.id||0);
  if(!ms){V={...v};clampView();draw();return;}
  const from={...V},t0=performance.now(),to={...v};
  const step=t=>{const k=clamp((t-t0)/ms,0,1),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    V={lon:from.lon+(to.lon-from.lon)*e,lat:from.lat+(to.lat-from.lat)*e,degW:Math.exp(Math.log(from.degW)+(Math.log(to.degW)-Math.log(from.degW))*e)};clampView();draw();
    if(k<1)anim={id:requestAnimationFrame(step)};else anim=null;};
  anim={id:requestAnimationFrame(step)};
}
/* The view that shows a set of routes with room around them, never tighter than MIN_DEG. */
function boxView(rs){
  if(!rs.length)return null;
  const pts=rs.flatMap(r=>[[r.a.lon,r.a.lat],[r.b.lon,r.b.lat]]);
  const lons=pts.map(p=>p[0]),lats=pts.map(p=>p[1]);
  const a=Math.min(...lons),b=Math.max(...lons),c=Math.min(...lats),d=Math.max(...lats);
  const needW=Math.max((b-a)*1.55+6,((d-c)*1.55+4)*W/H);
  const maxDeg=Math.min(360,180*W/H);
  return {lon:(a+b)/2,lat:(c+d)/2,degW:clamp(needW,MIN_DEG(),Math.max(MIN_DEG(),maxDeg))};
}
const fit=pts=>{};  // (kept for older callers; framing now goes through boxView)
function frame(){
  const e=EVENTS.get(SEL.ev),P=SEL.parent&&(e.parents||[]).find(p=>p.id===SEL.parent);
  const rs=SEL.id?[route(SEL.id)]:P?[...P.legs].map(route):e.routes;
  const v=boxView(rs);if(v)setView(v,650);
}
/* The camera that follows the action: routes starting soon or moving now. */
function followTarget(){
  const act=ROUTES.filter(r=>pass(r)&&r.start<=Y+10&&r.end+40>=Y);
  return boxView(act);
}
function followNow(ms){if(!auto||playing||SEL)return;const v=followTarget();if(v)setView(v,ms||700);}
function zoomAt(f,x=W/2,y=H/2){
  auto=false;
  const a=anchorAt(x,y);V.degW=V.degW/f;clampView();placeAnchor(a,x,y);clampView();
  const w=$('mapWrap');w.classList.add('zooming');clearTimeout(zT);zT=setTimeout(()=>{w.classList.remove('zooming');},220);draw();
}

/* ---------- drawing ---------- */
function el(n,a,p){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}
const GRAD={Red:['#D2463A','#8E1F18'],Blue:['#3D82D4','#174E92'],Charcoal:['#565C60','#2C3033']};   // same gradients as the globe
// Tapered ribbon, copied from the globe (app.js): wide tail, narrower neck, broad head.
function ribbon(pts,tail,neck,headLen,headHalf){
  const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y));
  let total=L.at(-1);if(total<headLen*1.6){const f=total/(headLen*1.6)*0.95;if(f<0.3)return null;tail*=f;neck*=f;headLen*=f;headHalf*=f;}
  const neckAt=total-headLen;let k=L.findIndex(v=>v>=neckAt);if(k<2)k=2;
  const nrm=i=>{const p=pts[Math.max(0,i-1)],q=pts[Math.min(pts.length-1,i+1)],dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy)||1;return [-dy/l,dx/l];};
  const left=[],right=[];for(let i=0;i<=k;i++){const w=(tail+(neck-tail)*(L[i]/neckAt))/2,n=nrm(i);left.push([pts[i].x+n[0]*w,pts[i].y+n[1]*w]);right.push([pts[i].x-n[0]*w,pts[i].y-n[1]*w]);}
  const n=nrm(k),dx=pts.at(-1).x-pts[k].x,dy=pts.at(-1).y-pts[k].y,l=Math.hypot(dx,dy)||1,tip=[pts[k].x+dx/l*headLen,pts[k].y+dy/l*headLen];
  const poly=[...left,[pts[k].x+n[0]*headHalf,pts[k].y+n[1]*headHalf],tip,[pts[k].x-n[0]*headHalf,pts[k].y-n[1]*headHalf],...right.reverse()];
  return 'M'+poly.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L')+' Z';
}
function draw(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;paint();});}
function paint(){
  const svg=$('map');if(!W||!ROUTES.length)return;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.textContent='';
  const s=scale(),NF=NEF(),nc=nProj(V.lon,V.lat),x0=(-NE_XM-nc[0])*NF+W/2,y0=(nc[1]-NE_YM)*NF+H/2;
  const defs=el('defs',{},svg);
  el('filter',{id:'routeShadow',x:'-10%',y:'-30%',width:'120%',height:'160%'},defs).appendChild((()=>{const b=document.createElementNS(NS,'feGaussianBlur');b.setAttribute('stdDeviation','2.4');return b;})());
  for(const [n,[c1,c2]] of Object.entries(GRAD)){const lg=el('linearGradient',{id:'rg-'+n,x1:0,y1:0,x2:0,y2:1},defs);el('stop',{offset:0,'stop-color':c1},lg);el('stop',{offset:1,'stop-color':c2},lg);}
  el('image',{href:'images/map-ne.jpg',x:x0,y:y0,width:2*NE_XM*NF,height:2*NE_YM*NF,preserveAspectRatio:'none'},svg);
  const selEv=SEL&&!SEL.auto?EVENTS.get(SEL.ev):null,selId=SEL?.id||null,selPar=SEL?.parent&&selEv?(selEv.parents||[]).find(p=>p.id===SEL.parent):null,legs=selPar?selPar.legs:null;
  const gR=el('g',{},svg),gP=el('g',{},svg),gL=el('g',{},svg),gH=el('g',{},svg);
  let shown=0;const pins=new Map(),cand=new Map();
  const list=ROUTES.filter(r=>pass(r)||(selEv&&r.ev===selEv.key));
  const coarse=matchMedia('(pointer:coarse)').matches;
  for(const r of list){
    const inSel=selEv&&r.ev===selEv.key,isSel=legs?legs.has(r.id):r.id===selId;
    let st=strength(r);
    if(inSel){st=st||{o:1,active:true};}
    if(!st)continue;
    if(!st.active&&!inSel&&selEv)continue;
    let o=st.o;if(selEv&&!inSel)o*=.28;if((selId||legs)&&inSel&&!isSel)o=.25;
    const A=px(r.a.lon,r.a.lat),B=px(r.b.lon,r.b.lat),dx=B[0]-A[0],dy=B[1]-A[1],C=[(A[0]+B[0])/2-dy*r.bend,(A[1]+B[1])/2+dx*r.bend];
    const d=`M${A[0].toFixed(1)},${A[1].toFixed(1)}Q${C[0].toFixed(1)},${C[1].toFixed(1)} ${B[0].toFixed(1)},${B[1].toFixed(1)}`;
    shown++;
    {const pts=[];for(let k=0;k<=48;k++){const t=k/48,u=1-t;pts.push({x:u*u*A[0]+2*u*t*C[0]+t*t*B[0],y:u*u*A[1]+2*u*t*C[1]+t*t*B[1]});}
      const rs=Math.max(.65,Math.min(1.2,Math.sqrt(s/16))),rd=ribbon(pts,(r.dotted?13:15)*rs,7.5*rs,24*rs,15*rs);   // same tapered ribbon as the globe
      if(rd){const g=el('g',{class:'route'+(isSel?' selected':''),opacity:o.toFixed(3)},gR);
        if(r.dotted){el('path',{d:rd,class:'routeTrad'},g);}
        else{el('path',{d:rd,class:'routeShadow',transform:`translate(${(2*rs).toFixed(1)} ${(3.5*rs).toFixed(1)})`},g);el('path',{d:rd,fill:`url(#rg-${r.cname})`,class:'routeBody'},g);}}}
    el('path',{d,fill:'none',stroke:'transparent','stroke-width':coarse?30:18,style:'cursor:pointer','data-id':r.id,role:'button','aria-label':`${shortName(r.a)} to ${shortName(r.b)}, ${yearLabel(r.start)}`},gH);
    pins.set(r.m.destinationPlaceId,[B,o,isSel]);pins.set(r.m.originPlaceId,pins.get(r.m.originPlaceId)||[A,o,false]);
    if(inSel||st.active){const rk=inSel?0:2,add=(id,p,k)=>{const c=cand.get(id);if(!c||k<c.k)cand.set(id,{p,k});};add(r.m.originPlaceId,A,rk);add(r.m.destinationPlaceId,B,rk+1);}
  }
  for(const [id,[p,o,isSel]] of pins){el('circle',{cx:p[0],cy:p[1],r:isSel?7:3.8,fill:isSel?'#0E1822':OUTLINE,stroke:isSel?'#E07B6E':'none','stroke-width':isSel?3:0,opacity:Math.max(.55,o)},gP);}
  /* Place names: every journey's start first, then its end, then the rest; a name that would overlap one already placed tries below the dot, then waits until you zoom in. */
  const placed=[],order=[...cand].sort((x,y)=>x[1].k-y[1].k),fs=phone()?12:13;
  for(const [id,{p}] of order){
    const name=shortName(PL.get(id));if(!name||p[0]<6||p[0]>W-6||p[1]<6||p[1]>H-6)continue;
    const w=name.length*(fs*.57)+8,hit=bx=>placed.some(q=>bx.x<q.x+q.w&&bx.x+bx.w>q.x&&bx.y<q.y+q.h&&bx.y+bx.h>q.y);
    let pos=null;
    for(const dy of [-26,8]){const bx={x:p[0]-w/2,y:p[1]+dy,w,h:fs+3};if(!hit(bx)){pos={bx,ty:dy<0?p[1]-11:p[1]+8+fs};break;}}
    if(!pos)continue;placed.push(pos.bx);
    const t=el('text',{x:p[0],y:pos.ty,'text-anchor':'middle','font-size':fs,'font-weight':600,fill:'#EFE6D3','font-family':'Instrument Sans,Arial,sans-serif','paint-order':'stroke',stroke:'#0E1822','stroke-width':3.5,'stroke-linejoin':'round'},gL);t.textContent=name;t.setAttribute('class','plname');
  }
  $('count').textContent=`${shown} route${shown===1?'':'s'} shown`;
}

/* ---------- panel: year, era, cards ---------- */
function showStory(){$('panel').classList.remove('inviting');}
function updateYear(){
  const y=Math.round(Y);$('year').innerHTML=y<0?`${-y}<span>BCE</span>`:String(y);
  const cur=ERAS.filter(e=>e.startYear<=Y).pop(),det=DETAIL.filter(e=>e.startYear<=Y).pop();$('era').textContent=det?det.name:(cur?cur.name:'');
  document.querySelectorAll('#ticks button').forEach(b=>b.classList.toggle('cur',cur&&+b.dataset.era===cur.era));
  if(eraPill)eraPill.setValue(cur?String(cur.era):null);
}
function selectRoute(id){const r=route(id);if(!r)return;showStory();SEL={ev:r.ev,id};card();frame();draw();}
function selectEvent(key){showStory();SEL={ev:key,id:null};card();frame();draw();}
function selectParent(id){const m=[...EVENTS.values()].find(e=>(e.parents||[]).some(p=>p.id===id));if(!m)return;showStory();SEL={ev:m.key,id:null,parent:id};card();frame();draw();}
function clearSel(){SEL=null;card();followNow(600);draw();}
function chipLabels(e){const names=e.routes.map(r=>shortName(r.b)),seen={};return names.map(n=>{seen[n]=(seen[n]||0)+1;return names.filter(x=>x===n).length>1?`${n} (${seen[n]})`:n;});}
const actKey=()=>[...EVENTS.values()].filter(e=>e.routes.some(r=>pass(r)&&strength(r)?.active)).map(e=>e.key).join(',');
function card(){
  const c=$('story');
  if(!SEL){
    const act=[...EVENTS.values()].filter(e=>e.routes.some(r=>pass(r)&&strength(r)?.active)).sort((a,b)=>a.start-b.start).slice(0,6);
    c.innerHTML=`<div class="kicker">Movements</div><h2>Follow our travels</h2><p id="storyText" class="blk">Tap a route on the map to read its story. Slide the year, or press Play, to watch the movements appear.</p>`+
      (act.length?`<div class="kicker blk" style="color:var(--amber)">Moving now</div><div class="now blk">${act.map(e=>`<button type="button" data-ev="${esc(e.key)}">${esc(bare(e.title))}<small>${esc(yearLabel(e.start))} &middot; ${e.routes.length} route${e.routes.length>1?'s':''}</small></button>`).join('')}</div>`:`<p class="soon blk">Nothing is moving in this year. Press Play or drag the slider.</p>`);
    c.querySelectorAll('[data-ev]').forEach(b=>b.addEventListener('click',()=>selectEvent(b.dataset.ev)));return;
  }
  const e=EVENTS.get(SEL.ev),r=SEL.id?route(SEL.id):null,P=SEL.parent?(e.parents||[]).find(p=>p.id===SEL.parent):null,labs=chipLabels(e),n=e.routes.length,deep=!!(r||P);
  const cause=e.routes[0].cause;
  let html=`<button type="button" id="closeStory" aria-label="Close story">&times;</button>`;
  if(deep&&n>1)html+=`<button type="button" class="back blk" id="cardBack">&larr; All ${n} routes</button>`;
  const ik=PREVIEW?EVSYM.get(e.key):null;html+=`<div class="kicker">${esc(cause||'Movement')}${ik?`<span class="kicon" role="img" aria-label="${esc(SYM_LABEL[ik])}" title="${esc(SYM_LABEL[ik])}">${SYM_SVG[ik].replace(/width="30" height="30"/,'width="22" height="22"')}</span>`:''}</div><div class="sdate">${esc(yearLabel(e.start))}</div><h2 class="blk">${esc(bare(e.title))}</h2>`;
  if(!deep){
    html+=e.card?`<p id="storyText" class="blk">${esc(bare(e.card.description))}</p>`:`<p id="storyText" class="blk">Route detail coming.</p>`;
  }else{
    const br=P?P.m.branch:r.m.branch;
    html+=`<div class="sub blk">${esc(bare(br?.subhead||('To '+shortName(r.b))))}</div>`;
    if(br){html+=`<p id="storyText" class="blk">${esc(bare(br.story))}</p>`;
      const tags=[br.group?br.group:'',br.mode?br.mode[0].toUpperCase()+br.mode.slice(1):''].filter(Boolean);
      if(tags.length)html+=`<div class="tags blk">${tags.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div>`;}
    else{html+=e.card?`<p id="storyText" class="blk">${esc(bare(e.card.description))}</p>`:'';html+=`<div class="soon blk">Route detail coming.</div>`;}
  }
  if(n>1){const hide=new Set((e.parents||[]).map(p=>[...p.legs].map(route).filter(x=>x&&x.m.destinationPlaceId&&shortName(x.b)===p.label).map(x=>x.id)).flat());
    const items=e.routes.map((x,i)=>({id:x.id,label:labs[i],on:!P&&r&&x.id===r.id})).filter(x=>!hide.has(x.id)).concat((e.parents||[]).map(p=>({par:p.id,label:p.label,on:P&&P.id===p.id})));
    html+=`<div class="chips blk"><button type="button" class="chip${deep?'':' on'}" data-chip="">All ${n} routes</button>${items.map(x=>`<button type="button" class="chip${x.on?' on':''}" data-chip="${esc(x.id||'')}" ${x.par?`data-par="${esc(x.par)}"`:''}>${esc(x.label)}</button>`).join('')}</div>`;}
  const dd=(P?P.m.branch:r&&r.m.branch)?.deepDive;
  if(dd)html+=`<details class="blk"><summary>Deep dive</summary><p>${esc(bare(dd))}</p></details>`;
  c.innerHTML=html;c.scrollTop=0;
  $('closeStory').addEventListener('click',clearSel);
  const back=$('cardBack');if(back)back.addEventListener('click',()=>{SEL={ev:e.key,id:null};card();frame();draw();});
  c.querySelectorAll('[data-chip]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.par)selectParent(b.dataset.par);else if(b.dataset.chip)selectRoute(b.dataset.chip);else{SEL={ev:e.key,id:null};card();frame();draw();}}));
}

/* ---------- filters (Era and Cause; Group, From and To are suppressed for now) ---------- */
const FIELDS=[
  {k:'era',label:'Era',opts:()=>ERAS.filter(e=>ROUTES.some(r=>r.era===e.era)).map(e=>[e.era,e.name])},
  {k:'cause',label:'Cause',opts:()=>CAUSES.filter(c=>ROUTES.some(r=>r.cause===c)).map(c=>[c,c])}
];
function valLabel(f){const v=F[f.k];if(v==null||v==='')return 'All';const o=f.opts().find(x=>x[0]===v);return o?o[1].replace(/^\d+\. /,''):'All';}
function selectors(){
  const box=$('sel');box.textContent='';
  for(const f of FIELDS){
    const b=document.createElement('button');b.className='pill';b.type='button';b.setAttribute('aria-haspopup','menu');b.dataset.k=f.k;
    b.innerHTML=`${esc(f.label)} <b>${esc(valLabel(f))}</b> &#9662;`;b.addEventListener('click',e=>{e.stopPropagation();openMenu(f,b);});box.appendChild(b);
  }
}
let menuEl=null;
function closeMenu(){if(menuEl){menuEl.remove();menuEl=null;}}
function openMenu(f,btn){
  closeMenu();const m=document.createElement('div');m.className='menu';m.setAttribute('role','menu');
  const mk=(v,t)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitemradio');b.setAttribute('aria-checked',String((F[f.k]??'')===(v??'')));b.textContent=t;
    b.addEventListener('click',()=>{F[f.k]=v;closeMenu();if(f.k==='era'&&v!=null){const e=ERAS.find(x=>x.era===v);if(e)setYear(Math.max(MINY,e.startYear));}selectors();lastKey='';if(!SEL)card();followNow(700);draw();});m.appendChild(b);};
  mk(null,'All');for(const [v,t] of f.opts())mk(v,t);
  $('mapWrap').appendChild(m);const r=btn.getBoundingClientRect(),w=$('mapWrap').getBoundingClientRect();
  m.style.left=clamp(r.left-w.left,8,Math.max(8,w.width-220))+'px';m.style.top=(r.bottom-w.top+6)+'px';menuEl=m;
}
document.addEventListener('click',e=>{if(menuEl&&!menuEl.contains(e.target))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();setKey(false);}});

/* ---------- map key ---------- */
const SYM_LABEL={octagon:'Massacred community',blackSquare:'Community no longer exists',purpleDiamond:'Forced conversion, other or unknown faith',splitDiamond:'Forced conversion to Christianity'};
const SYM_SVG={octagon:"<svg width=\"30\" height=\"30\" viewBox=\"-18 -18 36 36\" aria-hidden=\"true\"><path d=\"M15.71,6.51 L6.51,15.71 L-6.51,15.71 L-15.71,6.51 L-15.71,-6.51 L-6.51,-15.71 L6.51,-15.71 L15.71,-6.51 Z\" fill=\"#8C2A24\" stroke=\"#1B2328\" stroke-width=\"1.2\" stroke-linejoin=\"round\"/><path d=\"M0,-10.4 L9.01,5.2 L-9.01,5.2 Z M0,10.4 L-9.01,-5.2 L9.01,-5.2 Z\" fill=\"none\" stroke=\"#FFF3DC\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/></svg>",blackSquare:"<svg width=\"30\" height=\"30\" viewBox=\"-18 -18 36 36\" aria-hidden=\"true\"><path d=\"M-13,-13 H13 V13 H-13 Z\" fill=\"#20272B\" stroke=\"#1B2328\" stroke-width=\"1.2\" stroke-linejoin=\"round\"/><path d=\"M0,-10.4 L9.01,5.2 L-9.01,5.2 Z M0,10.4 L-9.01,-5.2 L9.01,-5.2 Z\" fill=\"none\" stroke=\"#FFF3DC\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/></svg>",purpleDiamond:"<svg width=\"30\" height=\"30\" viewBox=\"-18 -18 36 36\" aria-hidden=\"true\"><path d=\"M0,-17.4 L17.4,0 L0,17.4 L-17.4,0 Z\" fill=\"#5A3B7A\" stroke=\"#1B2328\" stroke-width=\"1.2\" stroke-linejoin=\"round\"/><path d=\"M0,-8.4 L7.27,4.2 L-7.27,4.2 Z M0,8.4 L-7.27,-4.2 L7.27,-4.2 Z\" fill=\"none\" stroke=\"#FFF3DC\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/></svg>",splitDiamond:"<svg width=\"30\" height=\"30\" viewBox=\"-18 -18 36 36\" aria-hidden=\"true\"><defs><clipPath id=\"kL\"><rect x=\"-20\" y=\"-20\" width=\"20\" height=\"40\"/></clipPath><clipPath id=\"kR\"><rect x=\"0\" y=\"-20\" width=\"20\" height=\"40\"/></clipPath></defs><path d=\"M0,-17.4 L17.4,0 L0,17.4 L-17.4,0 Z\" fill=\"#5A3B7A\" clip-path=\"url(#kL)\"/><path d=\"M0,-17.4 L17.4,0 L0,17.4 L-17.4,0 Z\" fill=\"#FFF3DC\" clip-path=\"url(#kR)\"/><path d=\"M0,-17.4 L17.4,0 L0,17.4 L-17.4,0 Z\" fill=\"none\" stroke=\"#1B2328\" stroke-width=\"1.2\" stroke-linejoin=\"round\"/><path d=\"M0,-10.6 L9.18,5.3 L-9.18,5.3 Z M0,10.6 L-9.18,-5.3 L9.18,-5.3 Z\" fill=\"none\" stroke=\"#FFF3DC\" stroke-width=\"1.6\" stroke-linejoin=\"round\" clip-path=\"url(#kL)\"/><path d=\"M1,-10.6 V10.6 M1,-3.6 H9.2\" fill=\"none\" stroke=\"#5A3B7A\" stroke-width=\"1.8\" stroke-linecap=\"square\"/></svg>"};
function buildKey(){if(!PREVIEW)return buildKeyOld();
  const arrow=(fill,extra='')=>`<svg width="44" height="18" aria-hidden="true"><path d="M2,13 Q22,2 34,8 L33,3 L43,10 L31,15 L32,11 Q22,7 4,16 Z" fill="${fill}" stroke="#FFF2DE" ${extra}/></svg>`;
  const used=new Set(ROUTES.map(r=>r.cname));
  // v0.8.0 (F-097, CEO 10/14): route labels in this order, then the symbols that appear on this page's cards. Jewish population shading is not drawn on this page, so it is not listed here.
  const syms=['octagon','blackSquare','purpleDiamond','splitDiamond'].filter(k=>[...EVSYM].some(([id,kind])=>kind===k&&EVENTS.has(id)));
  $('key').innerHTML=`<h2>Map key</h2>`+
    (used.has('Blue')?`<div>${arrow('#2D6CB8')}Return to the Land</div>`:'')+
    (used.has('Red')?`<div>${arrow('#B8352B')}Forced expulsion</div>`:'')+
    (used.has('Charcoal')?`<div>${arrow('#41464A')}Voluntary migration</div>`:'')+
    (ROUTES.some(r=>r.dotted)?`<div><svg width="44" height="18" aria-hidden="true"><path d="M2,13 Q22,2 34,8 L33,3 L43,10 L31,15 L32,11 Q22,7 4,16 Z" fill="rgba(255,242,222,.5)" stroke="#3F463F" stroke-dasharray="3 2"/></svg>Biblical/Traditional Account</div>`:'')+
    syms.map(k=>`<div>${SYM_SVG[k]}${SYM_LABEL[k]}</div>`).join('')+
    `<div style="color:var(--muted)">Tap an arrow to read that journey.</div>`;
}
function buildKeyOld(){
  const arrow=(fill,extra='')=>`<svg width="44" height="18" aria-hidden="true"><path d="M2,13 Q22,2 34,8 L33,3 L43,10 L31,15 L32,11 Q22,7 4,16 Z" fill="${fill}" stroke="#FFF2DE" ${extra}/></svg>`;
  const used=new Set(ROUTES.map(r=>r.cname));
  $('key').innerHTML=`<h2>Map key</h2>`+
    (used.has('Red')?`<div>${arrow('#B8352B')}Forced or persecution-driven movement</div>`:'')+
    (used.has('Blue')?`<div>${arrow('#2D6CB8')}Movement toward the Land of Israel</div>`:'')+
    (used.has('Charcoal')?`<div>${arrow('#41464A')}Other documented movement</div>`:'')+
    (ROUTES.some(r=>r.dotted)?`<div><svg width="44" height="18" aria-hidden="true"><path d="M2,13 Q22,2 34,8 L33,3 L43,10 L31,15 L32,11 Q22,7 4,16 Z" fill="rgba(255,242,222,.5)" stroke="#3F463F" stroke-dasharray="3 2"/></svg>Contested route (the sources disagree on the path)</div>`:'')+
    `<div style="color:var(--muted)">Tap an arrow to read that journey.</div>`;
}
function setKey(open){const k=$('key'),b=$('keyBtn');k.hidden=!open;b.setAttribute('aria-expanded',String(open));}

/* ---------- time and play ---------- */
/* The slider gives each era an equal stretch of track so the busy later eras are not squeezed. */
function bps(){const b=[MINY];for(const y of [...DETAIL.map(e=>e.startYear),...ERAS.map(e=>e.startYear)].sort((a,b)=>a-b)){if(y>MINY&&y<MAXY&&y!==b[b.length-1])b.push(y);}b.push(MAXY);return b;}
function y2p(y){const b=bps(),n=b.length-1;let i=0;while(i<n-1&&y>=b[i+1])i++;return (i+clamp((y-b[i])/(b[i+1]-b[i]),0,1))/n;}
function p2y(p){const b=bps(),n=b.length-1;const q=clamp(p,0,1)*n;const i=Math.min(Math.floor(q),n-1);return b[i]+(q-i)*(b[i+1]-b[i]);}
function setYear(y,fromSlider){
  Y=clamp(y,MINY,MAXY);if(!fromSlider)$('slider').value=Math.round(y2p(Y)*1000);
  updateYear();
  if(!SEL){const k=actKey();if(k!==lastKey){lastKey=k;card();}}
  draw();
}
function ticks(){
  const t=$('ticks');t.textContent='';
  const first=ERAS.filter(x=>x.startYear<=MINY).pop();
  for(const e of ERAS){if(!(e===first||(e.startYear>MINY&&e.startYear<=MAXY)))continue;
    const b=document.createElement('button');b.type='button';b.dataset.era=e.era;b.style.left=(y2p(Math.max(e.startYear,MINY))*100)+'%';
    b.textContent=e.name;b.setAttribute('aria-label',`Jump to ${e.name}`);b.addEventListener('click',()=>{stopPlay();SEL=null;setYear(Math.max(MINY,e.startYear));auto=true;followNow(800);});t.appendChild(b);}
  mountEra();setTimeout(mountEra,400);
}
function setPlayUI(){$('playIco').setAttribute('d',playing?ICO_PAUSE:ICO_PLAY);$('playLbl').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-pressed',String(playing));}
function stopPlay(){if(!playing)return;playing=false;setPlayUI();}
function startPlay(){
  showStory();playing=true;setPlayUI();SEL=null;lastKey='';dwellUntil=0;
  if(Y>=MAXY-1)setYear(MINY);else setYear(Y);
  lastT=performance.now();requestAnimationFrame(tick);
}
function togglePlay(){if(playing)stopPlay();else startPlay();}
/* Play pacing: normal speed while journeys are on screen; across a long stretch of years with none, it speeds up (easing in and out) so the gap takes about GAPSEC seconds. */
let GAPS=[];
function buildGaps(){
  const iv=ROUTES.map(r=>[r.start-2,r.end+HOLD]).sort((a,b)=>a[0]-b[0]);GAPS=[];let hi=iv[0]?iv[0][1]:0;
  for(const [a,b] of iv){if(a>hi)GAPS.push([hi,a]);hi=Math.max(hi,b);}
}
function playRate(y){
  const base=RATE*speed;
  for(const [a,b] of GAPS){if(y>=a&&y<b){const L=b-a,need=L/(GAPSEC/speed);if(need<=base)return base;const u=(y-a)/L;return Math.max(base,need*(0.4+1.2*Math.sin(Math.PI*u)));}}
  return base;
}
let dwellUntil=0;const CARD_DWELL=1500;   // like the globe, Play holds still while a movement's card is read
function tick(t){
  if(!playing)return;const dt=Math.min(.1,(t-lastT)/1000);lastT=t;
  if(t<dwellUntil){requestAnimationFrame(tick);return;}
  if(auto){const v=followTarget();if(v){const k=1-Math.exp(-dt*1.8);V={lon:V.lon+(v.lon-V.lon)*k,lat:V.lat+(v.lat-V.lat)*k,degW:Math.exp(Math.log(V.degW)+(Math.log(v.degW)-Math.log(V.degW))*k)};clampView();}}
  const y0=Y;setYear(Y+dt*playRate(Y));
  {const hit=[...EVENTS.values()].filter(e=>e.routes.some(pass)&&e.start>y0&&e.start<=Y).sort((a,b)=>a.start-b.start).pop();
    if(hit){SEL={ev:hit.key,id:null,auto:true};card();frame();draw();dwellUntil=t+CARD_DWELL;}}
  if(Y>=MAXY){playing=false;setPlayUI();return;}
  requestAnimationFrame(tick);
}
/* Previous and Next walk the journeys in order, like the globe walks its cards. */
function stepEvent(d){
  stopPlay();showStory();
  const evs=[...EVENTS.values()].filter(e=>e.routes.some(pass)).sort((a,b)=>a.start-b.start);if(!evs.length)return;
  let i=-1;
  if(SEL){i=evs.findIndex(e=>e.key===SEL.ev);i=i<0?0:i+d;}
  else if(d>0){i=evs.findIndex(e=>e.start>=(Y<=MINY+.5?Y-.5:Y+.5));if(i<0)i=evs.length-1;}
  else{for(let k=evs.length-1;k>=0;k--)if(evs[k].start<Y-.5){i=k;break;}if(i<0)i=0;}
  i=clamp(i,0,evs.length-1);const e=evs[i];
  auto=true;SEL={ev:e.key,id:null};setYear(clamp(e.routes[0].start,MINY,MAXY));card();frame();draw();
}
if(PREVIEW)window.OJJ_SUB={moved:()=>!auto,resetView(){auto=true;if(SEL)frame();else followNow(700);draw();}};   // F-085 subnav: Reset is the map position only
let eraPill=null;
function mountEra(){
  if(!PREVIEW||!window.OJJPill||eraPill)return;const h=$('subEra');if(!h)return;
  const first=ERAS.filter(x=>x.startYear<=MINY).pop(),list=ERAS.filter(e=>e===first||(e.startYear>MINY&&e.startYear<=MAXY)),cur=ERAS.filter(e=>e.startYear<=Y).pop();
  eraPill=OJJPill.create({label:'Era',scroll:true,nextLabel:'More eras',value:cur?String(cur.era):null,items:list.map(e=>({label:e.name,value:String(e.era)})),
    onSelect:it=>{const e=list.find(x=>String(x.era)===it.value);if(!e)return;stopPlay();SEL=null;setYear(Math.max(MINY,e.startYear));auto=true;followNow(800);}});
  eraPill.el.style.maxWidth='100%';h.appendChild(eraPill.el);
}
function reset(){
  stopPlay();F.era=null;F.cause=null;F.trails=false;SEL=null;auto=true;lastKey='';
  document.querySelectorAll('#options button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.trails==='on')===F.trails)));
  selectors();setYear(MINY);card();$('panel').classList.add('inviting');
  const v=followTarget();setView(v||HOME,600);
}

/* ---------- pointer: drag to pan, wheel and pinch to zoom, tap an arrow ---------- */
function wire(){
  const w=$('mapWrap'),pts=new Map();let pinch=null;
  w.addEventListener('pointerdown',e=>{stopPlay();if(e.target.closest('.sel,.zoom,.menu'))return;w.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);moved=false;
    if(pts.size===1)drag={x:e.clientX,y:e.clientY,lon:V.lon,lat:V.lat};if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),deg:V.degW};}});
  w.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size===2&&pinch){const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);moved=true;auto=false;const r=w.getBoundingClientRect();
      const cx=(a[0]+b[0])/2-r.left,cy=(a[1]+b[1])/2-r.top,an=anchorAt(cx,cy);V.degW=pinch.deg*pinch.d/d;clampView();placeAnchor(an,cx,cy);clampView();draw();return;}
    if(drag&&pts.size===1){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6){moved=true;auto=false;w.classList.add('drag');cancelAnimationFrame(anim?.id||0);}
      if(moved){const F=NEF(),q=nProj(drag.lon,drag.lat),c=nInv(q[0]-dx/F,q[1]+dy/F);V.lon=c[0];V.lat=c[1];clampView();draw();}}});
  const up=e=>{
    const wasTap=e.type==='pointerup'&&pts.size===1&&drag&&!moved&&pts.has(e.pointerId);
    pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size){drag=null;w.classList.remove('drag');}
    if(wasTap){   // pointer capture sends clicks to the map, so find the arrow under the finger ourselves
      const hit=document.elementsFromPoint(e.clientX,e.clientY).find(n=>n.dataset&&n.dataset.id&&n.closest('#map'));
      if(hit)selectRoute(hit.dataset.id);
    }
  };
  w.addEventListener('pointerup',up);w.addEventListener('pointercancel',up);
  w.addEventListener('wheel',e=>{if(e.target.closest('.menu'))return;e.preventDefault();stopPlay();const r=w.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  $('zin').addEventListener('click',()=>{stopPlay();zoomAt(1.5);});$('zout').addEventListener('click',()=>{stopPlay();zoomAt(1/1.5);});
  const sl=$('slider');sl.addEventListener('pointerdown',stopPlay);sl.addEventListener('keydown',stopPlay);
  sl.addEventListener('input',e=>{stopPlay();SEL=null;setYear(p2y((+e.target.value)/1000),true);clearTimeout(followT);followT=setTimeout(()=>{auto=true;followNow(700);},140);});
  $('play').addEventListener('click',togglePlay);$('prev').addEventListener('click',()=>stepEvent(-1));$('next').addEventListener('click',()=>stepEvent(1));
  $('introPlay').addEventListener('click',()=>{auto=true;startPlay();});
  $('introExplore').addEventListener('click',()=>{showStory();card();});
  $('reset').addEventListener('click',reset);
  $('keyBtn').addEventListener('click',e=>{e.stopPropagation();setKey($('key').hidden);});
  document.addEventListener('click',e=>{if(!$('key').hidden&&!$('key').contains(e.target)&&e.target!==$('keyBtn'))setKey(false);});
  document.querySelectorAll('#options button').forEach(b=>b.addEventListener('click',()=>{stopPlay();F.trails=b.dataset.trails==='on';document.querySelectorAll('#options button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw();}));
  let rt=0;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{size();clampView();draw();},80);});
}

/* ---------- boot ---------- */
(async function(){
  try{
    const res=await fetch('data/history.json');DATA=await res.json();
    if(!DATA.sheet?.movements?.length)throw new Error('no movements');
    build();size();HOME=homeView();V={...HOME};clampView();ticks();selectors();buildKey();wire();
    $('version').textContent='v'+(window.SITE_VERSION||'')+'; data '+(((DATA.sheet?.meta?.source||'').match(/v\d+(?:\.\d+)+/)||[])[0]||'unknown');
    setYear(MINY);card();{const v=followTarget();setView(v||HOME);}
    window.MV={routes:ROUTES,events:EVENTS,state:()=>({Y,V:{...V},SEL,F:{...F},playing,auto}),selectRoute,selectEvent,selectParent,setYear,stepEvent,togglePlay,follow:()=>{const v=followTarget();if(v)setView(v);},minY:MINY,maxY:MAXY,playRate,gaps:()=>GAPS};
  }catch(err){$('story').innerHTML='<h2>The map could not load</h2><p>Please refresh the page.</p>';$('panel').classList.remove('inviting');console.error(err);}
})();
})();
