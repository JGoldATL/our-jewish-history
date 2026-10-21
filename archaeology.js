/* Archaeology page "Found in the Ground" (F-113, v2.0.0). Flat map in the Movements style, built on the same projection, pan and zoom.
   Data: data/archaeology.json (written by tools/sheet-to-archaeology.py from the Master Sheet's Archaeology tab). Nothing here is written back.
   Rules (Dataset 10/21, Strategy pin simplification 10/21, Creative Design pins 10/21, CEO 10/21):
   - LOCKED records are public. LEANING and DRAFT records show only with ?drafts=1. A blank or other status never draws.
   - Three night pins at one size (Site, Writing, Object), the tip is the exact spot. No count badge, no fan-out, no Regional cue.
   - One pin per place: a Site that has a visible find linked to it is not drawn; the find's pin carries the card ("Found at" the site).
   - A pin sits at the find's discovery year (Discovery year lens) or at the start of the item's own period (Item's period lens).
   - Pins that share a spot are nudged a few pixels apart. Zoom by Importance: zoomed out shows 1; regional zoom adds 2; city zoom adds 3.
   - No Play button (CEO 10/21).
   - v2.0.2 Side card layout (CEO pick 10/21): the page opens with a find already open in a floating card and pins already on the map; the card has carousel
     dots and arrows; year, lens toggle and slider float along the bottom; Map key is pinned top left of the map; no intro card. */
(function(){
'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const DRAFTS=/[?&]drafts=1\b/.test(location.search);
const SHOW_DRAFT_STATUS=true;   // Dataset proposed that DRAFT never draws; Strategy has not confirmed. With ?drafts=1 DRAFT records draw so the whole set can be reviewed. Set false to hide them.
const YEAR_NOW=new Date().getFullYear(),FIRST_FOUND=1830;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bare=s=>typeof s!=='string'?s:(/\bBCE\b/.test(s)?s:s.replace(/\s+CE\b/g,''));   // project rule: bare Common Era years
const yearLabel=y=>y<0?`${-Math.round(y)} BCE`:String(Math.round(y));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:'';

/* The three pins, exactly as Creative Design drew them (symbol-archaeology-*.svg): 32 x 40, tip at (0,0), fill #162634, edge #E8B27A, symbol #F6EBD6. */
const PIN_D='M0,0 L-10.24,-16.74 A12,12 0 1 1 10.24,-16.74 Z',GLYPH_T='translate(-7.20,-30.20) scale(0.600)';
const GLYPH={
  Site:'<path d="M3.5 20h17"/><path d="M5.5 20V11.5a6.5 6.5 0 0 1 13 0V20"/><path d="M9 20v-6.5a3 3 0 0 1 6 0V20"/>',
  Writing:'<rect x="7" y="5" width="10" height="14" rx="1"/><rect x="5" y="3.5" width="14" height="2.5" rx="1.2"/><rect x="5" y="18" width="14" height="2.5" rx="1.2"/><path d="M10 10h4M10 13h4"/>',
  Object:'<path d="M9.5 3.5h5M10.5 3.5v3C7.5 7.5 6 10.5 6 14c0 3.5 2.5 6.5 6 6.5s6-3 6-6.5c0-3.5-1.5-6.5-4.5-7.5v-3"/><path d="M8 12.5h8"/>'
};
const KINDS=['Site','Writing','Object'];
const pinInner=k=>`<path d="${PIN_D}" fill="#162634" stroke="#E8B27A" stroke-width="1.6" stroke-linejoin="round"/><g transform="${GLYPH_T}" fill="none" stroke="#F6EBD6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${GLYPH[k]}</g>`;
const pinSvg=(k,sc=1)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${32*sc}" height="${40*sc}" viewBox="-16 -37 32 40" aria-hidden="true">${pinInner(k)}</svg>`;

let DATA=null,GEO=null,RECS=[],BYID=new Map(),PINS=[],LINKED=new Set();
let W=0,H=0,V={lon:29,lat:35,degW:60},HOME=null;
const FEATURED=['ARC-029'];   // the find the page opens on, when it is public; otherwise the first Importance 1 find
let LO=FIRST_FOUND,HI=YEAR_NOW,Y=YEAR_NOW,lens='found',SEL=null,anim=null,raf=0,drag=null,moved=false,zT=0,kbdFocus=null,auto=true;
const phone=()=>matchMedia('(max-width:620px) and (orientation:portrait)').matches;
const MIN_DEG=()=>2;              // city zoom: Jerusalem's pins can be told apart
const T2=()=>phone()?30:42,T3=()=>phone()?12:18;   // zoom steps (degrees across the map): below T2 Importance 2 is added, below T3 Importance 3

/* ---------- data ---------- */
const visible=r=>r.status==='LOCKED'||(DRAFTS&&(r.status==='LEANING'||(SHOW_DRAFT_STATUS&&r.status==='DRAFT')));
function build(){
  RECS=(DATA.records||[]).filter(visible);BYID=new Map(RECS.map(r=>[r.id,r]));
  // One pin per place: a Site with at least one visible find linked to it is not drawn (Strategy 10/21, F-143). Done here from Linked site ID; no Sheet change.
  LINKED=new Set(RECS.filter(r=>r.type==='Object'&&r.linkedSite&&BYID.has(r.linkedSite)).map(r=>r.linkedSite));
  PINS=RECS.filter(r=>!LINKED.has(r.id)).map(r=>{
    const site=r.type==='Object'?BYID.get(r.linkedSite):null;
    // A find carries its site's importance when that is higher (Hezekiah's Tunnel is Importance 1; its inscription alone is 2).
    const imp=Math.min(r.importance||3,site?site.importance||3:3);
    return {id:r.id,r,kind:r.symbol,lat:r.lat,lon:r.lon,imp};
  });
  PINS.sort((a,b)=>a.imp-b.imp||a.id.localeCompare(b.id));
  setRange();
}
const yOf=(p,l=lens)=>l==='found'?p.r.year:p.r.periodStart;
function setRange(){
  if(lens==='found'){const ys=PINS.map(p=>p.r.year);LO=Math.min(FIRST_FOUND,...(ys.length?ys:[FIRST_FOUND]));HI=YEAR_NOW;}
  else{const st=PINS.map(p=>p.r.periodStart).filter(Number.isFinite),en=PINS.map(p=>Math.max(p.r.periodStart,p.r.periodEnd??p.r.periodStart)).filter(Number.isFinite);
    LO=st.length?Math.floor(Math.min(...st)/10)*10:-1210;HI=en.length?Math.ceil(Math.max(...en)/10)*10:1900;}
}
const y2p=y=>(y-LO)/((HI-LO)||1),p2y=p=>LO+clamp(p,0,1)*(HI-LO);
const tierMax=()=>V.degW>T2()?1:V.degW>T3()?2:3;

/* ---------- view (projection, pan and zoom copied from Movements so the two maps behave the same) ---------- */
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
function size(){const w=$('mapWrap');W=w.clientWidth;H=w.clientHeight;$('stage').style.setProperty('--tb',$('tbar').offsetHeight+'px');}
function setView(v,ms){
  cancelAnimationFrame(anim?.id||0);
  if(!ms){V={...v};clampView();draw();return;}
  const from={...V},t0=performance.now(),to={...v};
  const step=t=>{const k=clamp((t-t0)/ms,0,1),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    V={lon:from.lon+(to.lon-from.lon)*e,lat:from.lat+(to.lat-from.lat)*e,degW:Math.exp(Math.log(from.degW)+(Math.log(to.degW)-Math.log(from.degW))*e)};clampView();draw();
    if(k<1)anim={id:requestAnimationFrame(step)};else anim=null;};
  anim={id:requestAnimationFrame(step)};
}

const narrow=()=>matchMedia('(max-width:900px)').matches;
function homeView(){const n=narrow();return n?{lon:35.2,lat:31.8,degW:clamp(W/25,12,32)}:{lon:34,lat:31.5,degW:clamp(W/28,30,48)};}   // opens on the Land with Importance 1 and 2 pins in place
function zoomAt(f,x=W/2,y=H/2){
  auto=false;
  const a=anchorAt(x,y);V.degW=V.degW/f;clampView();placeAnchor(a,x,y);clampView();
  const w=$('mapWrap');w.classList.add('zooming');clearTimeout(zT);zT=setTimeout(()=>{w.classList.remove('zooming');},220);draw();
}

function el(n,a,p){const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}

function draw(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;paint();});}

/* ---------- drawing ---------- */
function shownPins(){
  const t=tierMax();
  return PINS.filter(p=>Number.isFinite(yOf(p))&&yOf(p)<=Y&&(p.imp<=t||p.id===SEL));
}
function paint(){
  const svg=$('map');if(!W)return;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.textContent='';
  const s=scale(),NF=NEF(),nc=nProj(V.lon,V.lat),x0=(-NE_XM-nc[0])*NF+W/2,y0=(nc[1]-NE_YM)*NF+H/2;
  el('image',{href:'images/map-globe.webp',x:x0,y:y0,width:2*NE_XM*NF,height:2*NE_YM*NF,preserveAspectRatio:'none'},svg);
  const gG=el('g',{class:'geo'},svg);
  if(GEO){for(const r of GEO.rivers){let d='';r.forEach((q,i)=>{const a=px(q[0],q[1]);d+=(i?'L':'M')+a[0].toFixed(1)+','+a[1].toFixed(1);});el('path',{d,class:'river',fill:'none'},gG);}}
  const gP=el('g',{},svg),gL=el('g',{},svg);
  const list=shownPins();
  // Pins that share a spot are laid side by side, 26 px apart and centred on the spot, so none hides another. Pins that only crowd each other are then
  // nudged sideways where there is room (most important first, so it keeps its true spot). Where there is no room, zoom in to pull them apart.
  const base=new Map(),groups=new Map();
  for(const p of list){const k=p.lat.toFixed(3)+','+p.lon.toFixed(3);(groups.get(k)||groups.set(k,[]).get(k)).push(p);}
  for(const g of groups.values()){const a=px(g[0].lon,g[0].lat);g.forEach((p,i)=>base.set(p.id,[a[0]+(i-(g.length-1)/2)*26,a[1]]));}
  const placed=[],pos=new Map();
  for(const p of list){
    let [x,y]=base.get(p.id);
    if(x<-30||x>W+30||y<-10||y>H+60)continue;
    const clash=xx=>placed.some(q=>Math.abs(q[0]-xx)<26&&Math.abs(q[1]-y)<30);
    if(clash(x)){for(const dx of [26,-26,52,-52]){if(!clash(x+dx)){x+=dx;break;}}}
    placed.push([x,y]);pos.set(p.id,[x,y]);
  }
  const recent=lens==='found'?12:60;
  const order=[...pos.keys()].sort((a,b)=>pos.get(a)[1]-pos.get(b)[1]);
  for(const id of order){
    const p=PINS.find(q=>q.id===id),[x,y]=pos.get(id),sel=SEL===id;
    const g=el('g',{class:'pin'+(sel?' selected':''),transform:`translate(${x.toFixed(1)} ${y.toFixed(1)})`,tabindex:0,role:'button','data-pin':id,
      'aria-label':`${p.r.name}, ${p.kind}, found ${p.r.year}`},gP);
    el('rect',{x:-22,y:-42,width:44,height:44,fill:'transparent','data-id':id},g);   // invisible tap target, at least 44 x 44, centered on the pin
    if(Y-yOf(p)<recent)el('circle',{cx:0,cy:-24,r:18,class:'pinRing'},g);
    const inner=document.createElementNS(NS,'g');inner.innerHTML=pinInner(p.kind);g.appendChild(inner);
    el('rect',{x:-17,y:-39,width:34,height:44,rx:8,class:'pinFocus'},g);
  }
  // Names under the pins once the map is zoomed in (or for the selected pin), where they do not touch another pin or name.
  if(V.degW<=T2()||SEL){
    const fs=phone()?13:14.5,boxes=[...placed.map(q=>({x:q[0]-18,y:q[1]-42,w:36,h:46}))];
    for(const id of order){
      const p=PINS.find(q=>q.id===id);if(!(V.degW<=T2()||id===SEL))continue;
      const [x,y]=pos.get(id),name=bare(p.r.name),w=Math.min(name.length,34)*(fs*.5)+8,bx={x:x-w/2,y:y+5,w,h:fs+3};
      if(id!==SEL&&boxes.some(q=>bx.x<q.x+q.w&&bx.x+bx.w>q.x&&bx.y<q.y+q.h&&bx.y+bx.h>q.y))continue;
      if(bx.x<4||bx.x+bx.w>W-4||bx.y+bx.h>H-4)continue;
      boxes.push(bx);const t=el('text',{x,y:y+5+fs,'font-size':fs,class:'pinName'},gL);t.textContent=name.length>34?name.slice(0,33)+'…':name;
    }
  }
  /* the globe's sea and region names, only when zoomed in and only where they do not touch a pin name */
  if(GEO&&V.degW<=(phone()?50:80)){const gs=phone()?12:13,boxes=[...placed.map(q=>({x:q[0]-18,y:q[1]-42,w:36,h:46}))];
    for(const [t,k,lo,la] of GEO.labels){const a=px(lo,la),txt=k==='regionLabel'?t.toUpperCase():t,sea=k!=='regionLabel',fz=sea?15:gs-1,w=txt.length*fz*(sea?.5:.72)+10,bx={x:a[0]-w/2,y:a[1]-fz,w,h:fz+6};
      if(bx.x<8||bx.x+bx.w>W-8||bx.y<8||bx.y+bx.h>H-8)continue;if(boxes.some(q=>bx.x<q.x+q.w&&bx.x+bx.w>q.x&&bx.y<q.y+q.h&&bx.y+bx.h>q.y))continue;boxes.push(bx);
      const tx=el('text',{x:a[0],y:a[1],'text-anchor':'middle',class:'geoLbl '+(sea?'seaName':'regionName')},gG);tx.textContent=txt;}}
  if(kbdFocus){const n=svg.querySelector(`[data-pin="${kbdFocus}"]`);kbdFocus=null;if(n)n.focus({preventScroll:true});}
  updateCount();pager();
}

/* ---------- panel: year, count, card ---------- */
function updateCount(){
  const found=PINS.filter(p=>Number.isFinite(yOf(p))&&yOf(p)<=Y).length,shown=shownPins().length;
  const more=found-shown;
  $('hint').textContent=PINS.length?'Tap a pin to open it'+(more>0?` · ${more} more as you zoom in`:''):'';
}
function updateYear(){
  const y=Math.round(Y);$('year').innerHTML=y<0?`${-y}<span>BCE</span>`:String(y);
  updateCount();
}
function setYear(y,fromSlider){
  Y=clamp(Math.round(y),LO,HI);if(!fromSlider)$('slider').value=Math.round(y2p(Y)*1000);
  updateYear();draw();
}
function ends(){$('era').textContent=lens==='found'?'Year found':'Item’s own period';$('ends').innerHTML=`<span>${yearLabel(LO)}</span><span>${lens==='found'?'Today':yearLabel(HI)}</span>`;
  $('slider').setAttribute('aria-label',lens==='found'?'Year found':'Year of the item’s own period');}
function setLens(l){
  if(l===lens)return;const f=y2p(Y);lens=l;setRange();ends();
  document.querySelectorAll('#lens button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lens===lens)));
  setYear(p2y(f));
}
function card(){
  const c=$('story');pager();
  if(!SEL){
    c.innerHTML=PINS.length
      ?`<div class="kicker" style="color:var(--amber)">Archaeology</div><h2 class="blk">Tap a pin</h2><p id="storyText" class="blk">Each pin is a find. Tap one to read its story, or use the arrows to step through them.</p>`
      :`<div class="kicker" style="color:var(--amber)">Archaeology</div><h2 class="blk">Coming soon</h2><p id="storyText" class="blk">The first finds are still being checked. Please come back soon.</p>`;
    return;
  }
  const p=PINS.find(q=>q.id===SEL),r=p.r,site=r.type==='Object'?BYID.get(r.linkedSite):null;
  let h=`<button type="button" id="closeStory" aria-label="Close story">&times;</button>`;
  h+=`<div class="found-at">${site?'Found at '+esc(bare(site.name)):esc(r.type==='Site'?'Site':'Find')}</div><h2 class="blk">${esc(bare(r.name))}</h2>`;
  if(r.subhead)h+=`<div class="sub blk">${esc(bare(r.subhead))}</div>`;
  h+=`<div class="facts blk"><div><b>Found</b> ${esc(r.year)}</div>${r.periodLabel?`<div><b>From</b> ${esc(bare(r.periodLabel))}</div>`:''}</div>`;
  if(r.story)h+=`<p id="storyText" class="blk">${esc(bare(r.story))}</p>`;
  if(r.shows)h+=`<p class="shows blk"><em>What it shows</em><br>${esc(bare(r.shows))}</p>`;
  if(r.whereToSee||r.open){
    h+=`<div class="facts blk where">${r.whereToSee?`<div><b>Where to see it</b> ${esc(bare(r.whereToSee))}</div>`:''}${r.open?`<div><b>Open to the public</b> ${esc(r.open)}</div>`:''}</div>`;}
  const evs=(r.events||[]).filter(e=>e&&e.id);
  if(evs.length)h+=`<div class="links blk">${evs.map(e=>`<a href="events.html?card=${encodeURIComponent(e.id)}">See it on Events${e.title?': '+esc(bare(e.title)):''}</a>`).join('')}</div>`;
  const srcs=(r.sources||[]).filter(x=>x&&x.name);
  if(srcs.length)h+=`<div class="src blk">Sources: ${srcs.map(x=>safeUrl(x.url)?`<a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener">${esc(bare(x.name))}</a>`:esc(bare(x.name))).join(' · ')}</div>`;
  if(r.deepDive||r.limits||r.yearNote){
    h+=`<details class="blk"><summary>Deep dive</summary>${r.yearNote?`<p><b>About the year.</b> ${esc(bare(r.yearNote))}</p>`:''}${r.deepDive?`<p>${esc(bare(r.deepDive))}</p>`:''}${r.limits?`<p class="limits"><b>Limits.</b> ${esc(bare(r.limits))}</p>`:''}</details>`;}
  if(narrow())h+=`<button type="button" class="more" id="moreBtn" aria-expanded="false">Read more &#9656;</button>`;
  c.innerHTML=h;c.scrollTop=0;$('card').classList.remove('open');
  const mb=$('moreBtn');if(mb)mb.addEventListener('click',()=>{const o=!$('card').classList.contains('open');$('card').classList.toggle('open',o);mb.setAttribute('aria-expanded',String(o));mb.innerHTML=o?'Show less &#9652;':'Read more &#9656;';if(!o)c.scrollTop=0;});
  if(window.OJJShare)OJJShare.attach(c,{kind:'archaeology',label:false,getTitle:()=>bare(r.name)+' | Our Jewish Journey',getUrl:()=>location.origin+location.pathname+'?a='+encodeURIComponent(r.id)});
  $('closeStory').addEventListener('click',()=>select(null));
}
/* The part of the map not covered by the card, the time bar or the buttons: where a selected pin is moved to when it is not already in clear view. */
function freeBox(){
  const m=$('mapWrap').getBoundingClientRect(),c=$('card').getBoundingClientRect(),t=$('tbar').getBoundingClientRect();
  if(narrow())return {x0:34,x1:W-34,y0:72,y1:Math.max(140,c.top-m.top-14)};
  return {x0:40,x1:Math.max(200,c.left-m.left-34),y0:70,y1:Math.max(200,t.top-m.top-14)};
}
/* Carousel: the finds drawn on the map now (plus the open one), oldest find first. Zooming in adds more. */
function carousel(){
  const l=shownPins();if(SEL&&!l.some(p=>p.id===SEL)){const p=PINS.find(q=>q.id===SEL);if(p)l.push(p);}
  return l.sort((a,b)=>yOf(a)-yOf(b)||a.r.name.localeCompare(b.r.name)||a.id.localeCompare(b.id));
}
let PG=null;
function pager(){
  const l=carousel(),i=l.findIndex(p=>p.id===SEL);
  if(!PG)PG=OJJPager.mount($('card'),{label:'find',onStep:d=>step(d),onGo:k=>{const n=carousel()[k];if(n)select(n.id);}});
  if(!SEL||l.length<2||i<0){PG.hide();return;}
  PG.update({count:l.length,index:i,title:bare(PINS.find(p=>p.id===SEL).r.name),names:l.map(p=>bare(p.r.name))});
}
function step(d){const l=carousel(),i=l.findIndex(p=>p.id===SEL),n=l[clamp(i+d,0,l.length-1)];if(n&&n.id!==SEL)select(n.id);}
function select(id,opts){
  opts=opts||{};SEL=id;card();
  if(id){
    const p=PINS.find(q=>q.id===id);
    if(p&&opts.year&&yOf(p)>Y)setYear(yOf(p));
    if(p){const a=px(p.lon,p.lat),f=freeBox();
      if(opts.center||a[0]<f.x0||a[0]>f.x1||a[1]<f.y0+42||a[1]>f.y1){const deg=opts.center?Math.min(V.degW,30):V.degW,keep=V;V={...keep,degW:deg};clampView();placeAnchor([p.lon,p.lat],(f.x0+f.x1)/2,(f.y0+f.y1)/2+20);clampView();const to={...V};V=keep;setView(to,opts.boot?0:600);}}
    if(opts.kbd)kbdFocus=id;
  }
  draw();
}

/* ---------- map key ---------- */
function buildKey(){$('keyBtn').innerHTML=`${pinSvg('Site',.5)}<span>Map key</span>`;$('key').innerHTML=`<h2>Map key</h2>`+KINDS.map(k=>`<div class="pinKey">${pinSvg(k,.9)}${k}</div>`).join('');}
function setKey(open){const k=$('key'),b=$('keyBtn');k.hidden=!open;b.setAttribute('aria-expanded',String(open));}

/* ---------- pointer: drag to pan, wheel and pinch to zoom, tap a pin ---------- */
function wire(){
  const w=$('mapWrap'),pts=new Map();let pinch=null;
  w.addEventListener('pointerdown',e=>{w.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);moved=false;
    if(pts.size===1)drag={x:e.clientX,y:e.clientY,lon:V.lon,lat:V.lat};if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),deg:V.degW};}});
  w.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size===2&&pinch){const [a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);moved=true;const r=w.getBoundingClientRect();
      const cx=(a[0]+b[0])/2-r.left,cy=(a[1]+b[1])/2-r.top,an=anchorAt(cx,cy);V.degW=pinch.deg*pinch.d/d;clampView();placeAnchor(an,cx,cy);clampView();draw();return;}
    if(drag&&pts.size===1){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>6){moved=true;w.classList.add('drag');cancelAnimationFrame(anim?.id||0);}
      if(moved){const F=NEF(),q=nProj(drag.lon,drag.lat),c=nInv(q[0]-dx/F,q[1]+dy/F);V.lon=c[0];V.lat=c[1];clampView();draw();}}});
  const up=e=>{
    const wasTap=e.type==='pointerup'&&pts.size===1&&drag&&!moved&&pts.has(e.pointerId);
    pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size){drag=null;w.classList.remove('drag');}
    if(wasTap){   // pointer capture sends clicks to the map, so find the pin under the finger ourselves
      const hit=document.elementsFromPoint(e.clientX,e.clientY).find(n=>n.dataset&&n.dataset.id&&n.closest('#map'));
      if(hit)select(hit.dataset.id);
    }
  };
  w.addEventListener('pointerup',up);w.addEventListener('pointercancel',up);
  w.addEventListener('wheel',e=>{e.preventDefault();const r=w.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  $('map').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset&&e.target.dataset.pin){e.preventDefault();select(e.target.dataset.pin,{kbd:true});}});
  $('zin').addEventListener('click',()=>zoomAt(1.5));$('zout').addEventListener('click',()=>zoomAt(1/1.5));
  $('slider').addEventListener('input',e=>setYear(p2y((+e.target.value)/1000),true));
  document.querySelectorAll('#lens button').forEach(b=>b.addEventListener('click',()=>setLens(b.dataset.lens)));
  OJJPager.swipe($('story'),d=>{if(SEL)step(d);});OJJPager.keys(step,()=>!!SEL);
  $('keyBtn').addEventListener('click',e=>{e.stopPropagation();setKey($('key').hidden);});
  document.addEventListener('click',e=>{if(!$('key').hidden&&!$('key').contains(e.target)&&e.target!==$('keyBtn'))setKey(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){setKey(false);if(SEL)select(null);}});
  let rt=0;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{size();clampView();draw();},80);});
  if(window.ResizeObserver){let ro=0;new ResizeObserver(()=>{clearTimeout(ro);ro=setTimeout(()=>{if(w.clientWidth!==W||w.clientHeight!==H){size();clampView();draw();}else size();},30);}).observe(w);}   // the map and the bottom bar can change height after the fonts load
}
/* ---------- boot ---------- */
(async function(){
  try{
    const res=await fetch('data/archaeology.json');DATA=await res.json();try{GEO=await (await fetch('data/geo.json')).json();}catch(_){GEO=null;}
    build();size();HOME=homeView();V={...HOME};clampView();ends();buildKey();wire();
    $('version').textContent='v'+(window.SITE_VERSION||'')+'; data '+(((DATA.source||'').match(/v\d+(?:\.\d+)+/)||[])[0]||'unknown');
    const q=new URLSearchParams(location.search),k=q.get('a');
    let target=k&&BYID.get(k);if(target&&LINKED.has(target.id))target=RECS.find(r=>r.type==='Object'&&r.linkedSite===target.id)||target;   // a site that is not drawn opens its find
    setYear(HI);setView(HOME);
    if(target&&PINS.some(p=>p.id===target.id))select(target.id,{year:true,center:true});
    else if(PINS.length){const f=FEATURED.map(id=>PINS.find(p=>p.id===id)).find(Boolean)||PINS[0];select(f.id,{boot:true});}   // the page opens with a find open
    else card();
    window.ARC={setView,homeView,pins:()=>PINS,recs:()=>RECS,linked:()=>LINKED,state:()=>({Y,V:{...V},SEL,lens,LO,HI,shown:shownPins().map(p=>p.id)}),select,step,carousel,setYear,setLens,tierMax};
  }catch(err){$('story').innerHTML='<h2>The map could not load</h2><p>Please refresh the page.</p>';console.error(err);}
})();
})();
