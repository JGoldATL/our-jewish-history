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
/* Era tabs come from the Sheet: each data era carries a Headline era name (Eras tab, column Q); consecutive eras with the same headline share one tab, which starts at the earliest of them. */
function headlineEras(det){const out=[];for(const e of det){const nm=e.headline||e.name;let g=out.find(x=>x.name===nm);if(g)g.startYear=Math.min(g.startYear,e.startYear);else out.push({era:out.length+1,name:nm,startYear:e.startYear});}return out.sort((a,b)=>a.startYear-b.startYear).map((g,i)=>({...g,era:i+1}));}
/* Interim map labels (CEO, Oct 13): the Sheet's Map label wins unless listed here. Delete an entry once the Sheet says the same. */
const LABEL_OVERRIDE={'place-poland':'Poland','place-constantinople':'Constantinople'};
const placeLabel=p=>p?(LABEL_OVERRIDE[p.id]||p.mapLabel||shortName(p)):'';
const GAPSEC=1.8;   // a stretch of years with no journeys on screen takes about this long at 1x
/* Cause: five headings. Persistent flight joins Persecution; Relocation stays its own heading (CEO Oct 13); returns are not shown at all. */
const CAUSE_OF={'expulsion':'Expulsion','persecution-driven flight':'Persecution','persistent flight':'Persecution','deportation':'Deportation','voluntary migration':'Voluntary migration','relocation':'Relocation'};
const CAUSES=['Deportation','Expulsion','Persecution','Relocation','Voluntary migration'];
const HOLD=15,FADE=6,RATE=30;              // years a route stays bright after it ends, years to fade in, years per second at 1x
const ICO_PLAY='M3.5,1.5 L13.5,8 L3.5,14.5 Z',ICO_PAUSE='M3.5,1.5 H6.5 V14.5 H3.5 Z M9.5,1.5 H12.5 V14.5 H9.5 Z';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bare=s=>typeof s!=='string'?s:(/\bBCE\b/.test(s)?s:s.replace(/\s+CE\b/g,''));   // project rule: bare Common Era years
const yearLabel=y=>y<0?`${-Math.round(y)} BCE`:String(Math.round(y));
const shortName=p=>String(p?.historicalName||'').split(/ \/ | \(/)[0];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

let DATA=null,PL=new Map(),CARDS=new Map(),ERAS=[],DETAIL=[],ROUTES=[],PARENT_IDS=new Set(),EVENTS=new Map(),MINY=0,MAXY=1;
let W=0,H=0,V={lon:20,lat:38,degW:100},HOME=null;
let Y=0,playing=false,speed=1,lastT=0,auto=true,lastKey='';
const F={era:null,cause:null,trails:false};   // Group, From and To filters are suppressed for now (roadmap F-088)
let SEL=null;                               // {ev:eventKey, id:routeId|null, parent:parentId|null}
let anim=null,raf=0,drag=null,moved=false,followT=0;
const phone=()=>matchMedia('(max-width:620px) and (orientation:portrait)').matches;
const MIN_DEG=()=>phone()?46:34;            // never zoom in further than this width in degrees: a region stays recognisable

/* ---------- data ---------- */
function build(){
  const S=DATA.sheet;PL=new Map(S.places.map(p=>[p.id,p]));CARDS=new Map(S.cards.map(c=>[c.id,c]));
  DETAIL=(S.eras||[]).slice().sort((a,b)=>a.startYear-b.startYear);ERAS=headlineEras(DETAIL);
  const eraOf=y=>{let e=null;for(const x of ERAS)if(x.startYear<=y)e=x;return e?e.era:null;};
  const ok=m=>m.arrowEndsReady&&[m.originPlaceId,m.destinationPlaceId].every(id=>Number.isFinite(PL.get(id)?.lat)&&Number.isFinite(PL.get(id)?.lon));
  let rows=S.movements.filter(m=>ok(m)&&m.character!=='return/aliyah'&&m.startYear>=FIRST_YEAR);
  const have=new Set(rows.map(m=>m.id));
  rows=rows.filter(m=>m.id!=='MOV-055'||['MOV-052','MOV-053','MOV-054'].every(x=>have.has(x)));   // branch rule from the Dataset chat
  const sib=new Map();
  ROUTES=rows.map(m=>{const t=m.arrowTreatment||'',c=/^Red/.test(t)?'Red':/^Blue/.test(t)?'Blue':'Charcoal';
    return {id:m.id,ev:m.eventId||m.id,m,a:PL.get(m.originPlaceId),b:PL.get(m.destinationPlaceId),start:m.startYear,end:m.endYear??m.startYear,
      color:COLORS[c],cname:c,dotted:/^Dotted/i.test(t),cause:CAUSE_OF[m.character]||'',era:eraOf(m.startYear)};});
  for(const r of ROUTES){const k=r.ev+'|'+r.m.originPlaceId;(sib.get(k)||sib.set(k,[]).get(k)).push(r);}
  for(const g of sib.values())g.forEach((r,i)=>{r.bend=g.length>1?(i-(g.length-1)/2)*0.22:0.12;});
  EVENTS=new Map();
  for(const r of ROUTES){let e=EVENTS.get(r.ev);if(!e){const c=CARDS.get(r.ev);e={key:r.ev,card:c&&(c.status==='approved'||DRAFTS)?c:null,routes:[]};EVENTS.set(r.ev,e);}e.routes.push(r);}
  for(const e of EVENTS.values()){e.routes.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
    e.title=e.card?.title||`${shortName(e.routes[0].a)} to ${shortName(e.routes[0].b)}`;e.start=e.card?.startYear??e.routes[0].start;}
  /* Parent rows (no arrow of their own, e.g. MOV-054 Barbados, MOV-055 New Amsterdam): their route is the leg rows that list them in Linked records,
     plus any earlier leg that ends where a leg begins. Tapping the parent chip lights all legs. */
  /* Dataset parent-row rule: blank Destination Place ID and the ID is named in another row's Linked records. Never draws; its branches do. */
  const LINKED=new Set();for(const m of S.movements)for(const l of m.links||[])LINKED.add(l);
  PARENT_IDS=new Set(S.movements.filter(m=>!m.destinationPlaceId&&LINKED.has(m.id)).map(m=>m.id));
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
const scale=()=>W/V.degW;
const px=(lon,lat)=>{const s=scale();return [(lon-V.lon)*s+W/2,(V.lat-lat)*s+H/2];};
function clampView(){
  const maxDeg=Math.min(360,180*W/H);V.degW=clamp(V.degW,MIN_DEG(),Math.max(MIN_DEG(),maxDeg));
  const hs=V.degW*H/W/2,lo=-90+hs,hi=90-hs;V.lat=lo>hi?0:clamp(V.lat,lo,hi);V.lon=clamp(V.lon,-180,180);
}
function size(){const w=$('mapWrap');W=w.clientWidth;H=w.clientHeight;}
function homeView(){const p=phone();return {lon:p?10:22,lat:p?40:38,degW:p?60:Math.min(100,Math.max(60,W/9))};}
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
  const s=scale(),lon=V.lon+(x-W/2)/s,lat=V.lat-(y-H/2)/s;V.degW=V.degW/f;clampView();
  const s2=scale();V.lon=lon-(x-W/2)/s2;V.lat=lat+(y-H/2)/s2;clampView();draw();
}

/* ---------- drawing ---------- */
function el(n,a,p){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}
function draw(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;paint();});}
function paint(){
  const svg=$('map');if(!W||!ROUTES.length)return;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.textContent='';
  const s=scale(),[x0,y0]=px(-180,90);
  const defs=el('defs',{},svg);
  for(const c of new Set(ROUTES.map(r=>r.color))){const m=el('marker',{id:'ah'+c.slice(1),viewBox:'0 0 10 10',refX:'7',refY:'5',markerWidth:'5',markerHeight:'5',orient:'auto'},defs);el('path',{d:'M0,0L10,5L0,10z',fill:c,stroke:OUTLINE,'stroke-width':'1.2'},m);}
  el('image',{href:'images/map-night.jpg',x:x0,y:y0,width:360*s,height:180*s,preserveAspectRatio:'none'},svg);
  const selEv=SEL?EVENTS.get(SEL.ev):null,selId=SEL?.id||null,selPar=SEL?.parent&&selEv?(selEv.parents||[]).find(p=>p.id===SEL.parent):null,legs=selPar?selPar.legs:null;
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
    if(isSel){
      el('path',{d,fill:'none',stroke:r.dotted?TRAD:r.color,'stroke-width':18,opacity:.28,'stroke-linecap':'round'},gR);
      el('path',{d,fill:'none',stroke:OUTLINE,'stroke-width':6.5,'stroke-linecap':'round','stroke-dasharray':'14 9',class:'flow'},gR);
    }else if(r.dotted){
      el('path',{d,fill:'none',stroke:TRAD,'stroke-width':3.4,opacity:o.toFixed(2),'stroke-linecap':'round','stroke-dasharray':'1 7'},gR);
    }else{
      const w=st.active?3.6:2;
      el('path',{d,fill:'none',stroke:OUTLINE,'stroke-width':w+2.4,opacity:(o*.9).toFixed(2),'stroke-linecap':'round'},gR);
      el('path',{d,fill:'none',stroke:r.color,'stroke-width':w,opacity:o.toFixed(2),'stroke-linecap':'round','marker-end':st.active?`url(#ah${r.color.slice(1)})`:''},gR);
    }
    el('path',{d,fill:'none',stroke:'transparent','stroke-width':coarse?30:18,style:'cursor:pointer','data-id':r.id,role:'button','aria-label':`${shortName(r.a)} to ${shortName(r.b)}, ${yearLabel(r.start)}`},gH);
    pins.set(r.m.destinationPlaceId,[B,o,isSel]);pins.set(r.m.originPlaceId,pins.get(r.m.originPlaceId)||[A,o,false]);
    if(inSel||st.active){const rk=inSel?0:2,add=(id,p,k)=>{const c=cand.get(id);if(!c||k<c.k)cand.set(id,{p,k});};add(r.m.originPlaceId,A,rk);add(r.m.destinationPlaceId,B,rk+1);}
  }
  for(const [id,[p,o,isSel]] of pins){el('circle',{cx:p[0],cy:p[1],r:isSel?7:3.8,fill:isSel?'#0E1822':OUTLINE,stroke:isSel?'#E07B6E':'none','stroke-width':isSel?3:0,opacity:Math.max(.55,o)},gP);}
  /* Place names: every journey's start first, then its end, then the rest; a name that would overlap one already placed tries below the dot, then waits until you zoom in. */
  const placed=[],order=[...cand].sort((x,y)=>x[1].k-y[1].k),fs=phone()?12:13;
  for(const [id,{p}] of order){
    const name=placeLabel(PL.get(id));if(!name||p[0]<6||p[0]>W-6||p[1]<6||p[1]>H-6)continue;
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
  html+=`<div class="kicker">${esc(cause||'Movement')}</div><div class="sdate">${esc(yearLabel(e.start))}</div><h2 class="blk">${esc(bare(e.title))}</h2>`;
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
function buildKey(){
  const arrow=(fill,extra='')=>`<svg width="44" height="18" aria-hidden="true"><path d="M2,13 Q22,2 34,8 L33,3 L43,10 L31,15 L32,11 Q22,7 4,16 Z" fill="${fill}" stroke="#FFF2DE" ${extra}/></svg>`;
  const used=new Set(ROUTES.map(r=>r.cname));
  $('key').innerHTML=`<h2>Map key</h2>`+
    (used.has('Red')?`<div>${arrow('#B8352B')}Forced or persecution-driven movement</div>`:'')+
    (used.has('Blue')?`<div>${arrow('#2D6CB8')}Movement toward the Land of Israel</div>`:'')+
    (used.has('Charcoal')?`<div>${arrow('#41464A')}Other documented movement</div>`:'')+
    (ROUTES.some(r=>r.dotted)?`<div><svg width="44" height="18" aria-hidden="true"><path d="M3,13 Q22,2 41,10" fill="none" stroke="#EFE6D3" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="1 7"/></svg>Contested route (the sources disagree on the path)</div>`:'')+
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
}
function setPlayUI(){$('playIco').setAttribute('d',playing?ICO_PAUSE:ICO_PLAY);$('playLbl').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-pressed',String(playing));}
function stopPlay(){if(!playing)return;playing=false;setPlayUI();}
function startPlay(){
  showStory();playing=true;setPlayUI();SEL=null;lastKey='';
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
function tick(t){
  if(!playing)return;const dt=Math.min(.1,(t-lastT)/1000);lastT=t;
  if(auto){const v=followTarget();if(v){const k=1-Math.exp(-dt*1.8);V={lon:V.lon+(v.lon-V.lon)*k,lat:V.lat+(v.lat-V.lat)*k,degW:Math.exp(Math.log(V.degW)+(Math.log(v.degW)-Math.log(V.degW))*k)};clampView();}}
  setYear(Y+dt*playRate(Y));
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
      const cx=(a[0]+b[0])/2-r.left,cy=(a[1]+b[1])/2-r.top,s=scale(),lon=V.lon+(cx-W/2)/s,lat=V.lat-(cy-H/2)/s;V.degW=pinch.deg*pinch.d/d;clampView();const s2=scale();V.lon=lon-(cx-W/2)/s2;V.lat=lat+(cy-H/2)/s2;clampView();draw();return;}
    if(drag&&pts.size===1){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6){moved=true;auto=false;w.classList.add('drag');cancelAnimationFrame(anim?.id||0);}
      if(moved){const s=scale();V.lon=drag.lon-dx/s;V.lat=drag.lat+dy/s;clampView();draw();}}});
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
    $('version').textContent='v'+(window.SITE_VERSION||'')+' · Movements · data from Sheet '+(((DATA.sheet?.meta?.source||'').match(/v\d+(?:\.\d+)+/)||[])[0]||'');
    setYear(MINY);card();{const v=followTarget();setView(v||HOME);}
    window.MV={routes:ROUTES,events:EVENTS,state:()=>({Y,V:{...V},SEL,F:{...F},playing,auto}),selectRoute,selectEvent,selectParent,setYear,stepEvent,togglePlay,follow:()=>{const v=followTarget();if(v)setView(v);},minY:MINY,maxY:MAXY,playRate,gaps:()=>GAPS,parentIds:()=>[...PARENT_IDS]};
  }catch(err){$('story').innerHTML='<h2>The map could not load</h2><p>Please refresh the page.</p>';$('panel').classList.remove('inviting');console.error(err);}
})();
})();
