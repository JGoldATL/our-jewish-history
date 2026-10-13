/* Movements page (F-084, v0.7.0 first slice).
   Flat map of Jewish movement. Data: data/history.json "sheet" (Movements, Events cards, Places, Eras). Nothing here is written back.
   One card per event; tapping a route (or a destination chip) sets that route off and opens its branch card: the event title stays,
   a subhead names the destination, and the story and deep dive speak only about that branch. A branch with no approved text shows the
   event story and a "route detail coming" marker. Only approved cards show (add ?drafts=1 to preview drafts). */
(function(){
'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const DRAFTS=/[?&]drafts=1\b/.test(location.search);
const COLORS={Red:'#E07B6E',Blue:'#6FA8E8',Charcoal:'#B8AFA0'};
const SHORT={1:'Origins',2:'Exile',3:'Rome',4:'Islamic world',5:'Medieval',6:'New diasporas',7:'Modern'};
const HOLD=15,FADE=6,RATE=30;            // years a route stays bright after it ends, years it takes to fade in, years per second at 1x
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bare=s=>typeof s!=='string'?s:(/\bBCE\b/.test(s)?s:s.replace(/\s+CE\b/g,''));   // project rule: bare Common Era years
const yearLabel=y=>y<0?`${-Math.round(y)} BCE`:String(Math.round(y));
const cap=s=>{s=String(s||'').replace(/\//g,' / ').replace(/\s+/g,' ').trim();return s?s[0].toUpperCase()+s.slice(1):s;};
const shortName=p=>String(p?.historicalName||'').split(/ \/ | \(/)[0];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

let DATA=null,PL=new Map(),CARDS=new Map(),ERAS=[],ROUTES=[],EVENTS=new Map(),MINY=0,MAXY=1;
let W=0,H=0,V={lon:20,lat:38,degW:100},HOME=null;
let Y=0,playing=false,speed=1,lastT=0;
const F={era:null,group:null,from:null,to:null,cause:null,trad:true,all:false,trails:true};
let SEL=null;                               // {ev:eventKey, id:routeId|null}
let anim=null,raf=0,drag=null,moved=false;
const phone=()=>matchMedia('(max-width:620px) and (orientation:portrait)').matches;

/* ---------- data ---------- */
function build(){
  const S=DATA.sheet;PL=new Map(S.places.map(p=>[p.id,p]));CARDS=new Map(S.cards.map(c=>[c.id,c]));
  ERAS=(S.eras||[]).slice().sort((a,b)=>a.startYear-b.startYear);
  const eraOf=y=>{let e=null;for(const x of ERAS)if(x.startYear<=y)e=x;return e?e.era:null;};
  const ok=m=>m.arrowEndsReady&&[m.originPlaceId,m.destinationPlaceId].every(id=>Number.isFinite(PL.get(id)?.lat)&&Number.isFinite(PL.get(id)?.lon));
  let rows=S.movements.filter(ok);
  const have=new Set(rows.map(m=>m.id));
  rows=rows.filter(m=>m.id!=='MOV-055'||['MOV-052','MOV-053','MOV-054'].every(x=>have.has(x)));   // branch rule from the Dataset chat
  const sib=new Map();
  ROUTES=rows.map(m=>{const t=m.arrowTreatment||'',c=/^Red/.test(t)?'Red':/^Blue/.test(t)?'Blue':'Charcoal';
    return {id:m.id,ev:m.eventId||m.id,m,a:PL.get(m.originPlaceId),b:PL.get(m.destinationPlaceId),start:m.startYear,end:m.endYear??m.startYear,
      color:COLORS[c],dotted:/^Dotted/i.test(t),cause:m.character||'',group:m.branch?.group||'',era:eraOf(m.startYear)};});
  for(const r of ROUTES){const k=r.ev+'|'+r.m.originPlaceId;(sib.get(k)||sib.set(k,[]).get(k)).push(r);}
  for(const g of sib.values())g.forEach((r,i)=>{r.bend=g.length>1?(i-(g.length-1)/2)*0.22:0.12;});
  EVENTS=new Map();
  for(const r of ROUTES){let e=EVENTS.get(r.ev);if(!e){const c=CARDS.get(r.ev);e={key:r.ev,card:c&&(c.status==='approved'||DRAFTS)?c:null,routes:[]};EVENTS.set(r.ev,e);}e.routes.push(r);}
  for(const e of EVENTS.values()){e.routes.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
    e.title=e.card?.title||`${shortName(e.routes[0].a)} to ${shortName(e.routes[0].b)}`;e.start=e.card?.startYear??e.routes[0].start;}
  /* Parent rows (no arrow of their own, e.g. MOV-054 Barbados, MOV-055 New Amsterdam): their route is the leg rows that list them in Linked records,
     plus any earlier leg that ends where a leg begins (Recife to Amsterdam, then Amsterdam to Barbados). Tapping the parent chip lights all legs. */
  for(const m of S.movements){
    if(m.arrowEndsReady||!m.branch||!m.eventId)continue;const e=EVENTS.get(m.eventId);if(!e)continue;
    const legs=new Set(e.routes.filter(r=>(r.m.links||[]).includes(m.id)).map(r=>r.id));if(!legs.size)continue;
    for(const id of [...legs]){let L=route(id),guard=0;while(L&&L.m.originPlaceId!==m.originPlaceId&&guard++<6){const X=e.routes.find(x=>x.m.destinationPlaceId===L.m.originPlaceId&&x.start<=L.start&&!legs.has(x.id));if(!X)break;legs.add(X.id);L=X;}}
    (e.parents||(e.parents=[])).push({id:m.id,m,legs,label:m.destination});
  }
  MINY=Math.min(...ROUTES.map(r=>r.start));MAXY=Math.max(...ROUTES.map(r=>r.end));
}
const route=id=>ROUTES.find(r=>r.id===id);
const pass=r=>(F.era==null||r.era===F.era)&&(!F.group||r.group===F.group)&&(!F.from||r.m.originPlaceId===F.from)&&(!F.to||r.m.destinationPlaceId===F.to)
  &&(!F.cause||r.cause===F.cause)&&(F.trad||!r.dotted);
function strength(r){
  if(F.all)return {o:1,active:true};
  if(Y<r.start)return null;
  if(Y<=r.end+HOLD)return {o:Math.min(1,(Y-r.start+1)/FADE),active:true};
  return F.trails?{o:.2,active:false}:null;
}

/* ---------- view ---------- */
const scale=()=>W/V.degW;
const px=(lon,lat)=>{const s=scale();return [(lon-V.lon)*s+W/2,(V.lat-lat)*s+H/2];};
function clampView(){
  const maxDeg=Math.min(360,180*W/H);V.degW=clamp(V.degW,5,maxDeg);
  const hs=V.degW*H/W/2,lo=-90+hs,hi=90-hs;V.lat=lo>hi?0:clamp(V.lat,lo,hi);V.lon=clamp(V.lon,-180,180);
}
function size(){const w=$('mapWrap');W=w.clientWidth;H=w.clientHeight;}
function homeView(){const p=phone();return {lon:p?10:22,lat:p?40:38,degW:p?52:Math.min(100,Math.max(60,W/9))};}
function setView(v,ms){
  cancelAnimationFrame(anim?.id||0);
  if(!ms){V={...v};clampView();draw();return;}
  const from={...V},t0=performance.now(),to={...v};
  const step=t=>{const k=clamp((t-t0)/ms,0,1),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    V={lon:from.lon+(to.lon-from.lon)*e,lat:from.lat+(to.lat-from.lat)*e,degW:Math.exp(Math.log(from.degW)+(Math.log(to.degW)-Math.log(from.degW))*e)};clampView();draw();
    if(k<1)anim={id:requestAnimationFrame(step)};else anim=null;};
  anim={id:requestAnimationFrame(step)};
}
function fit(pts){
  if(!pts.length)return;
  const lons=pts.map(p=>p[0]),lats=pts.map(p=>p[1]);
  let a=Math.min(...lons),b=Math.max(...lons),c=Math.min(...lats),d=Math.max(...lats);
  const sLon=Math.max(b-a,6),sLat=Math.max(d-c,4),card=$('card');
  const availW=phone()?W:Math.max(260,W-(card.hidden?0:card.offsetWidth+30)),availH=phone()?Math.max(160,H-(card.hidden?0:card.offsetHeight)):H-50;
  const s=Math.min(availW*.78/sLon,availH*.7/sLat),cLon=(a+b)/2,cLat=(c+d)/2,tx=availW/2,ty=(phone()?availH/2+30:availH/2+50);
  const degW=clamp(W/s,5,Math.min(360,180*W/H));const s2=W/degW;
  setView({lon:cLon-(tx-W/2)/s2,lat:cLat+(ty-H/2)/s2,degW},520);
}
function zoomAt(f,x=W/2,y=H/2){
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
  for(const c of new Set(ROUTES.map(r=>r.color))){const m=el('marker',{id:'ah'+c.slice(1),viewBox:'0 0 10 10',refX:'7',refY:'5',markerWidth:'4.5',markerHeight:'4.5',orient:'auto'},defs);el('path',{d:'M0,0L10,5L0,10z',fill:c},m);}
  el('image',{href:'images/map-night.jpg',x:x0,y:y0,width:360*s,height:180*s,preserveAspectRatio:'none'},svg);
  const selEv=SEL?EVENTS.get(SEL.ev):null,selId=SEL?.id||null,selPar=SEL?.parent&&selEv?(selEv.parents||[]).find(p=>p.id===SEL.parent):null,legs=selPar?selPar.legs:null,gR=el('g',{},svg),gP=el('g',{},svg),gL=el('g',{},svg),gH=el('g',{},svg);
  let shown=0;const pins=new Map(),labels=new Map();
  const list=ROUTES.filter(r=>pass(r)||(selEv&&r.ev===selEv.key));
  for(const r of list){
    const inSel=selEv&&r.ev===selEv.key,isSel=legs?legs.has(r.id):r.id===selId;
    let st=strength(r);
    if(inSel){st=st||{o:1,active:true};}
    if(!st)continue;
    if(!st.active&&!inSel&&selEv)continue;
    let o=st.o;if(selEv&&!inSel)o*=.28;if((selId||legs)&&inSel&&!isSel)o=.2;
    const A=px(r.a.lon,r.a.lat),B=px(r.b.lon,r.b.lat),dx=B[0]-A[0],dy=B[1]-A[1],C=[(A[0]+B[0])/2-dy*r.bend,(A[1]+B[1])/2+dx*r.bend];
    const d=`M${A[0].toFixed(1)},${A[1].toFixed(1)}Q${C[0].toFixed(1)},${C[1].toFixed(1)} ${B[0].toFixed(1)},${B[1].toFixed(1)}`;
    shown++;
    if(isSel){
      el('path',{d,fill:'none',stroke:r.color,'stroke-width':16,opacity:.2,'stroke-linecap':'round'},gR);
      el('path',{d,fill:'none',stroke:'#FFD9CF','stroke-width':5.5,'stroke-linecap':'round','stroke-dasharray':'14 9',class:'flow'},gR);
    }else{
      const w=st.active?3.2:1.8;
      el('path',{d,fill:'none',stroke:r.color,'stroke-width':w,opacity:o.toFixed(2),'stroke-linecap':'round','stroke-dasharray':r.dotted?'1 7':'','marker-end':st.active&&!r.dotted?`url(#ah${r.color.slice(1)})`:''},gR);
    }
    const hit=el('path',{d,fill:'none',stroke:'transparent','stroke-width':16,style:'cursor:pointer','data-id':r.id,role:'button','aria-label':`${shortName(r.a)} to ${shortName(r.b)}, ${yearLabel(r.start)}`},gH);
    hit.addEventListener('click',()=>{if(!moved)selectRoute(r.id);});
    pins.set(r.m.destinationPlaceId,[B,o,isSel]);pins.set(r.m.originPlaceId,pins.get(r.m.originPlaceId)||[A,o,false]);
    if(inSel){labels.set(r.m.originPlaceId,A);labels.set(r.m.destinationPlaceId,B);}
    else if(V.degW<30&&st.active)labels.set(r.m.destinationPlaceId,B);
  }
  for(const [id,[p,o,isSel]] of pins){const pl=PL.get(id);el('circle',{cx:p[0],cy:p[1],r:isSel?7:3.6,fill:isSel?'#0E1822':'#EFE6D3',stroke:isSel?'#E07B6E':'none','stroke-width':isSel?3:0,opacity:Math.max(.5,o)},gP);}
  for(const [id,p] of labels){const t=el('text',{x:p[0],y:p[1]-11,'text-anchor':'middle','font-size':13,'font-weight':600,fill:'#EFE6D3','font-family':'Instrument Sans,Arial,sans-serif','paint-order':'stroke',stroke:'#0E1822','stroke-width':3.5,'stroke-linejoin':'round'},gL);t.textContent=shortName(PL.get(id));}
  const tot=ROUTES.filter(pass).length;
  $('count').textContent=`${shown} route${shown===1?'':'s'} shown · ${tot} of ${ROUTES.length} match`;
}

/* ---------- selection and cards ---------- */
function selectRoute(id){const r=route(id);if(!r)return;SEL={ev:r.ev,id};card();frame();}
function selectEvent(key){SEL={ev:key,id:null};card();frame();}
function selectParent(id){const m=[...EVENTS.values()].find(e=>(e.parents||[]).some(p=>p.id===id));if(!m)return;SEL={ev:m.key,id:null,parent:id};card();frame();}
function clearSel(){SEL=null;card();setView(HOME,420);}
function frame(){const e=EVENTS.get(SEL.ev),P=SEL.parent&&(e.parents||[]).find(p=>p.id===SEL.parent),rs=SEL.id?[route(SEL.id)]:P?[...P.legs].map(route):e.routes;fit(rs.flatMap(r=>[[r.a.lon,r.a.lat],[r.b.lon,r.b.lat]]));}
function chipLabels(e){const names=e.routes.map(r=>shortName(r.b)),seen={};return names.map((n,i)=>{seen[n]=(seen[n]||0)+1;return names.filter(x=>x===n).length>1?`${n} (${seen[n]})`:n;});}
function card(){
  const c=$('card');c.hidden=false;
  if(!SEL){
    const act=[...EVENTS.values()].filter(e=>e.routes.some(r=>pass(r)&&strength(r)?.active)).sort((a,b)=>a.start-b.start).slice(0,6);
    c.innerHTML=`<div class="k">Movements</div><h2>Follow our travels</h2><p>Tap a route on the map to read its story. Slide the year, or press Play, to watch the movements appear.</p>`+
      (act.length?`<div class="k" style="margin-top:14px;color:var(--amber)">Moving now</div><div class="now">${act.map(e=>`<button data-ev="${esc(e.key)}">${esc(bare(e.title))}<small>${esc(yearLabel(e.start))} · ${e.routes.length} route${e.routes.length>1?'s':''}</small></button>`).join('')}</div>`:`<p class="soon">Nothing is moving in this year. Press Play or drag the slider.</p>`);
    c.querySelectorAll('[data-ev]').forEach(b=>b.addEventListener('click',()=>selectEvent(b.dataset.ev)));return;
  }
  const e=EVENTS.get(SEL.ev),r=SEL.id?route(SEL.id):null,P=SEL.parent?(e.parents||[]).find(p=>p.id===SEL.parent):null,labs=chipLabels(e),n=e.routes.length,deep=!!(r||P);
  const cause=cap(e.routes[0].cause),kick=`${esc(cause?cause+' · ':'')}${esc(yearLabel(e.start))}`;
  let html=`<button class="back" id="cardBack">${deep&&n>1?`&larr; All ${n} routes`:'Close'}</button><div class="k">${kick}</div><h2>${esc(bare(e.title))}</h2>`;
  if(!r&&!P){
    html+=e.card?`<p>${esc(bare(e.card.description))}</p>`:`<p>Route detail coming.</p>`;
  }else{
    const br=P?P.m.branch:r.m.branch;
    html+=`<div class="sub">${esc(bare(br?.subhead||('To '+shortName(r.b))))}</div>`;
    if(br){html+=`<p>${esc(bare(br.story))}</p>`;
      const tags=[br.group?br.group:'',br.mode?cap(br.mode):''].filter(Boolean);
      if(tags.length)html+=`<div class="tags">${tags.map(t=>`<span class="pill">${esc(t)}</span>`).join('')}</div>`;}
    else{html+=e.card?`<p>${esc(bare(e.card.description))}</p>`:'';html+=`<div class="soon">Route detail coming.</div>`;}
  }
  if(n>1){const hide=new Set((e.parents||[]).map(p=>[...p.legs].map(route).filter(x=>x&&x.m.destinationPlaceId&&shortName(x.b)===p.label).map(x=>x.id)).flat());
    const items=e.routes.map((x,i)=>({id:x.id,label:labs[i],on:!P&&r&&x.id===r.id})).filter(x=>!hide.has(x.id)).concat((e.parents||[]).map(p=>({par:p.id,label:p.label,on:P&&P.id===p.id})));
    html+=`<div class="chips"><button class="pill${r||P?'':' on'}" data-chip="">All ${n} routes</button>${items.map(x=>`<button class="pill${x.on?' on':''}" data-chip="${esc(x.id||'')}" ${x.par?`data-par="${esc(x.par)}"`:''}>${esc(x.label)}</button>`).join('')}</div>`;}
  const dd=(P?P.m.branch:r&&r.m.branch)?.deepDive;
  if(dd)html+=`<details><summary>Deep dive</summary><p>${esc(bare(dd))}</p></details>`;
  c.innerHTML=html;c.scrollTop=0;
  $('cardBack').addEventListener('click',()=>{if(deep&&n>1){SEL={ev:e.key,id:null};card();frame();}else clearSel();});
  c.querySelectorAll('[data-chip]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.par)selectParent(b.dataset.par);else if(b.dataset.chip)selectRoute(b.dataset.chip);else{SEL={ev:e.key,id:null};card();frame();}}));
}

/* ---------- selectors ---------- */
const FIELDS=[
  {k:'era',label:'Era',opts:()=>ERAS.filter(e=>ROUTES.some(r=>r.era===e.era)).map(e=>[e.era,`${e.era}. ${e.name}`])},
  {k:'group',label:'Group',opts:()=>[...new Set(ROUTES.map(r=>r.group).filter(Boolean))].sort().map(g=>[g,g])},
  {k:'from',label:'From',opts:()=>uniq(r=>r.m.originPlaceId,r=>shortName(r.a))},
  {k:'to',label:'To',opts:()=>uniq(r=>r.m.destinationPlaceId,r=>shortName(r.b))},
  {k:'cause',label:'Cause',opts:()=>[...new Set(ROUTES.map(r=>r.cause).filter(Boolean))].sort().map(c=>[c,cap(c)])}
];
function uniq(idf,namef){const m=new Map();for(const r of ROUTES)m.set(idf(r),namef(r));return [...m].sort((a,b)=>a[1].localeCompare(b[1]));}
function valLabel(f){const v=F[f.k];if(v==null||v==='')return 'All';const o=f.opts().find(x=>x[0]===v);return o?o[1].replace(/^\d+\. /,''):'All';}
function selectors(){
  const box=$('sel');box.textContent='';
  for(const f of FIELDS){
    const b=document.createElement('button');b.className='pill';b.type='button';b.setAttribute('aria-haspopup','menu');b.dataset.k=f.k;
    b.innerHTML=`${esc(f.label)} <b>${esc(valLabel(f))}</b> &#9662;`;b.addEventListener('click',e=>{e.stopPropagation();openMenu(f,b);});box.appendChild(b);
  }
  for(const [k,label] of [['trad','Traditional routes'],['trails','Trails'],['all','Show all']]){
    const b=document.createElement('button');b.className='pill'+(F[k]?' on':'');b.type='button';b.setAttribute('aria-pressed',F[k]);b.dataset.k=k;b.textContent=label;
    b.addEventListener('click',()=>{F[k]=!F[k];selectors();card();draw();});box.appendChild(b);
  }
}
let menuEl=null;
function closeMenu(){if(menuEl){menuEl.remove();menuEl=null;}}
function openMenu(f,btn){
  closeMenu();const m=document.createElement('div');m.className='menu';m.setAttribute('role','menu');
  const mk=(v,t)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitemradio');b.setAttribute('aria-checked',String((F[f.k]??'')===(v??'')));b.textContent=t;
    b.addEventListener('click',()=>{F[f.k]=v;closeMenu();if(f.k==='era'&&v!=null){const e=ERAS.find(x=>x.era===v);if(e)setYear(Math.max(MINY,e.startYear));}selectors();card();draw();});m.appendChild(b);};
  mk(null,'All');for(const [v,t] of f.opts())mk(v,t);
  $('mapWrap').appendChild(m);const r=btn.getBoundingClientRect(),w=$('mapWrap').getBoundingClientRect();
  m.style.left=clamp(r.left-w.left,8,Math.max(8,w.width-210))+'px';m.style.top=(r.bottom-w.top+6)+'px';menuEl=m;
}
document.addEventListener('click',e=>{if(menuEl&&!menuEl.contains(e.target))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
/* phone bottom sheet: tap the handle area to expand or collapse */
(()=>{const c=$('card');c.addEventListener('click',e=>{if(!matchMedia('(max-width:620px) and (orientation:portrait)').matches)return;const r=c.getBoundingClientRect();if(e.clientY-r.top<34)c.classList.toggle('open');});})();

/* ---------- time ---------- */
/* Slider is era-weighted: each era gets an equal stretch of track so the busy later eras are not squeezed. */
function bps(){const b=[MINY];for(const e of ERAS){if(e.startYear>MINY&&e.startYear<MAXY)b.push(e.startYear);}b.push(MAXY);return b;}
function y2p(y){const b=bps(),n=b.length-1;let i=0;while(i<n-1&&y>=b[i+1])i++;return (i+clamp((y-b[i])/(b[i+1]-b[i]),0,1))/n;}
function p2y(p){const b=bps(),n=b.length-1;const q=clamp(p,0,1)*n;const i=Math.min(Math.floor(q),n-1);return b[i]+(q-i)*(b[i+1]-b[i]);}
function setYear(y,fromSlider){
  Y=clamp(y,MINY,MAXY);if(!fromSlider)$('slider').value=Math.round(y2p(Y)*1000);
  $('yr').textContent=F.all?'All':yearLabel(Y);
  const cur=ERAS.filter(e=>e.startYear<=Y).pop();
  document.querySelectorAll('#ticks button').forEach(b=>b.classList.toggle('cur',cur&&+b.dataset.era===cur.era));
  if(!SEL)card();
  draw();
}
function ticks(){
  const t=$('ticks');t.textContent='';
  const first=ERAS.filter(x=>x.startYear<=MINY).pop();
  for(const e of ERAS){if(!(e===first||(e.startYear>MINY&&e.startYear<=MAXY)))continue;
    const b=document.createElement('button');b.type='button';b.dataset.era=e.era;b.style.left=(y2p(Math.max(e.startYear,MINY))*100)+'%';
    b.textContent=SHORT[e.era]||e.name;b.setAttribute('aria-label',`Jump to ${e.name}`);b.addEventListener('click',()=>setYear(Math.max(MINY,e.startYear)));t.appendChild(b);}
}
function togglePlay(){
  playing=!playing;$('play').innerHTML=playing?'&#10074;&#10074; Pause':'&#9654; Play';
  if(playing){if(Y>=MAXY)setYear(MINY);lastT=performance.now();requestAnimationFrame(tick);}
}
function tick(t){if(!playing)return;const dt=(t-lastT)/1000;lastT=t;setYear(Y+dt*RATE*speed);if(Y>=MAXY){playing=false;$('play').innerHTML='&#9654; Play';return;}requestAnimationFrame(tick);}
function eraStep(d){
  const st=ERAS.filter(e=>e.startYear<=MAXY).map(e=>Math.max(MINY,e.startYear));const u=[...new Set(st)].sort((a,b)=>a-b);
  if(d<0){const p=u.filter(x=>x<Math.floor(Y)-1).pop();setYear(p??MINY);}else{const n=u.find(x=>x>Math.floor(Y)+1);setYear(n??MAXY);}
}

/* ---------- pointer: drag to pan, wheel and pinch to zoom ---------- */
function wire(){
  const w=$('mapWrap'),pts=new Map();let pinch=null;
  w.addEventListener('pointerdown',e=>{if(e.target.closest('.sel,.zoom,#card,.menu'))return;w.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);moved=false;
    if(pts.size===1)drag={x:e.clientX,y:e.clientY,lon:V.lon,lat:V.lat};if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),deg:V.degW};}});
  w.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size===2&&pinch){const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);moved=true;const r=w.getBoundingClientRect();
      const cx=(a[0]+b[0])/2-r.left,cy=(a[1]+b[1])/2-r.top,s=scale(),lon=V.lon+(cx-W/2)/s,lat=V.lat-(cy-H/2)/s;V.degW=pinch.deg*pinch.d/d;clampView();const s2=scale();V.lon=lon-(cx-W/2)/s2;V.lat=lat+(cy-H/2)/s2;clampView();draw();return;}
    if(drag&&pts.size===1){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5){moved=true;w.classList.add('drag');cancelAnimationFrame(anim?.id||0);}
      if(moved){const s=scale();V.lon=drag.lon-dx/s;V.lat=drag.lat+dy/s;clampView();draw();}}});
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size){drag=null;w.classList.remove('drag');setTimeout(()=>{moved=false;},0);}};
  w.addEventListener('pointerup',up);w.addEventListener('pointercancel',up);
  w.addEventListener('wheel',e=>{if(e.target.closest('#card,.menu'))return;e.preventDefault();const r=w.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  $('zin').addEventListener('click',()=>zoomAt(1.5));$('zout').addEventListener('click',()=>zoomAt(1/1.5));$('zhome').addEventListener('click',()=>{if(SEL)clearSel();else setView(HOME,420);});
  $('slider').addEventListener('input',e=>{setYear(p2y((+e.target.value)/1000),true);});
  $('play').addEventListener('click',togglePlay);$('prevEra').addEventListener('click',()=>eraStep(-1));$('nextEra').addEventListener('click',()=>eraStep(1));
  $('speed').addEventListener('click',()=>{speed=speed===1?2:speed===2?4:1;$('speed').innerHTML=speed+'&times;';});
  let rt=0;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{size();if(!SEL)HOME=homeView();clampView();draw();},80);});
}

/* ---------- boot ---------- */
(async function(){
  try{
    const res=await fetch('data/history.json');DATA=await res.json();
    if(!DATA.sheet?.movements?.length)throw new Error('no movements');
    build();size();HOME=homeView();V={...HOME};clampView();ticks();selectors();wire();setYear(MINY);card();draw();
    window.MV={routes:ROUTES,events:EVENTS,state:()=>({Y,V:{...V},SEL,F:{...F},playing}),selectRoute,selectEvent,selectParent,setYear,minY:MINY,maxY:MAXY};
  }catch(err){document.getElementById('card').innerHTML='<h2>The map could not load</h2><p>Please refresh the page.</p>';console.error(err);}
})();
})();
