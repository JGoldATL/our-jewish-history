'use strict';
const APP_VERSION='0.3.3';
/* Jewish Journeys · Globe preview
   Rendering layer only. Records, validation, frame resolution and evidence rules come from engine.js,
   ported verbatim from Alpha 1.13, so historical behaviour is unchanged. */
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
let DATA=null,INDEX=null,GEO=null,SHEETPL=new Map();
const D2R=Math.PI/180;
const svgToLonLat=([x,y])=>[x/15-15,58-y*53/650];

/* ---------- globe projection: magnified orthographic ---------- */
const view={lon:35,lat:31,deg:15,R:390,baseR:390,zoom:1,cx:450,cy:420,manual:false};
const ZMIN=1,ZMAX=3.2;
function unproject(x,y){const dx=(x-view.cx)/view.R,dy=(y-view.cy)/view.R,r=Math.hypot(dx,dy);if(r>=1)return null;const del=Math.asin(r)/(90/view.deg),th=Math.atan2(dx,-dy),p0=view.lat*D2R,l0=view.lon*D2R;const lat=Math.asin(Math.sin(p0)*Math.cos(del)+Math.cos(p0)*Math.sin(del)*Math.cos(th));const lon=l0+Math.atan2(Math.sin(th)*Math.sin(del)*Math.cos(p0),Math.cos(del)-Math.sin(p0)*Math.sin(lat));return [lon/D2R,lat/D2R];}
// Zoom brings the globe closer while keeping the spot under the pointer (or the screen centre) in place.
function setZoom(z,ax,ay){const nz=Math.max(ZMIN,Math.min(ZMAX,z));if(ax==null){const st=$('stage');ax=st.clientWidth/2;ay=Math.min(view.cy,st.clientHeight/2);}
  const anchor=unproject(ax,ay);view.zoom=nz;view.R=view.baseR*nz;
  if(anchor&&nz>1.001){for(let i=0;i<3;i++){const q=project(anchor[0],anchor[1]),k=90/view.deg,dpp=1/(view.R*k)/D2R;view.lat=Math.max(-70,Math.min(80,view.lat-(q.y-ay)*dpp));view.lon+=(q.x-ax)*dpp/Math.max(.2,Math.cos(view.lat*D2R));}view.manual=true;}
  render();}
function project(lon,lat){
  const l0=view.lon*D2R,p0=view.lat*D2R,l=lon*D2R,p=lat*D2R;
  const cosd=Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(l-l0);
  const d=Math.acos(Math.max(-1,Math.min(1,cosd)));
  const th=Math.atan2(Math.sin(l-l0)*Math.cos(p),Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(l-l0));
  const k=90/view.deg,dp=d*k,vis=dp<Math.PI/2;
  const r=Math.sin(Math.min(dp,Math.PI/2));
  return {x:view.cx+view.R*r*Math.sin(th),y:view.cy-view.R*r*Math.cos(th),vis,depth:dp};
}
const P=c=>{const [lo,la]=svgToLonLat(c);return project(lo,la);};

/* ---------- WebGL globe ---------- */
let gl,prog,uni={},texReady=0,washTex=null;const washCanvas=document.createElement('canvas'),wctx=washCanvas.getContext('2d');
const VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FS=`precision highp float;
uniform vec2 uC;uniform float uR;uniform vec2 uCen;uniform float uK;uniform sampler2D uW;uniform sampler2D uG;uniform vec4 uGB;uniform float uDpr;uniform vec2 uSize;uniform sampler2D uWash;
void main(){
 vec2 px=vec2(gl_FragCoord.x,uSize.y-gl_FragCoord.y)/uDpr;
 vec2 d=(px-uC)/uR;float r=length(d);
 if(r>1.0){gl_FragColor=vec4(0.);return;}
 float dp=asin(min(r,1.0));float del=dp/uK;float th=atan(d.x,-d.y);
 float p0=uCen.y,l0=uCen.x;
 float lat=asin(sin(p0)*cos(del)+cos(p0)*sin(del)*cos(th));
 float lon=l0+atan(sin(th)*sin(del)*cos(p0),cos(del)-sin(p0)*sin(lat));
 float LON=degrees(lon),LAT=degrees(lat);
 LON=mod(LON+180.,360.)-180.;
 vec3 col;
 if(LON>=uGB.x&&LON<=uGB.y&&LAT>=uGB.z&&LAT<=uGB.w){
   col=texture2D(uG,vec2((LON-uGB.x)/(uGB.y-uGB.x),(uGB.w-LAT)/(uGB.w-uGB.z))).rgb;
 }else{
   col=texture2D(uW,vec2((LON+180.)/360.,(90.-LAT)/180.)).rgb;
 }
 float land=smoothstep(0.07,0.0,col.b-col.r);
 float wa=texture2D(uWash,vec2(gl_FragCoord.x/uSize.x,1.-gl_FragCoord.y/uSize.y)).a;
 col=mix(col,col*vec3(0.36,0.52,0.88),clamp(wa*land,0.,0.92));
 vec3 n=vec3(d.x,-d.y,sqrt(max(0.,1.-r*r)));
 vec3 L=normalize(vec3(-.45,.55,.75));
 float diff=.62+.48*max(dot(n,L),0.);
 float limb=1.-.55*pow(r,3.2);
 col*=diff*limb;
 float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),24.)*.10;
 col+=spec;
 float a=clamp((1.-r)*uR*uDpr,0.,1.);
 gl_FragColor=vec4(col*a,a);
}`;
function initGL(){
  const c=$('gl');gl=c.getContext('webgl',{premultipliedAlpha:true,antialias:true});if(!gl)throw new Error('WebGL is not available in this browser.');
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
  prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);gl.useProgram(prog);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  for(const n of ['uC','uR','uCen','uK','uW','uG','uGB','uDpr','uSize','uWash'])uni[n]=gl.getUniformLocation(prog,n);
  gl.uniform1i(uni.uW,0);gl.uniform1i(uni.uG,1);gl.uniform1i(uni.uWash,2);washTex=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,washTex);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);gl.uniform4f(uni.uGB,-20,80,0,60);
  loadTex('images/tex-world.jpg',0,true);loadTex('images/tex-region.jpg',1,false);
}
function loadTex(src,unit,wrap){const img=new Image();img.onload=()=>{gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);const w=wrap?gl.REPEAT:gl.CLAMP_TO_EDGE;gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,w);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);texReady++;drawGlobe();};img.src=src;}
function drawGlobe(){
  if(!gl||texReady<2)return;const c=$('gl'),dpr=Math.min(2,window.devicePixelRatio||1),w=c.clientWidth,h=c.clientHeight;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  gl.viewport(0,0,c.width,c.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uni.uC,view.cx,view.cy);gl.uniform1f(uni.uR,view.R);gl.uniform2f(uni.uCen,view.lon*D2R,view.lat*D2R);gl.uniform1f(uni.uK,90/view.deg);gl.uniform1f(uni.uDpr,dpr);gl.uniform2f(uni.uSize,c.width,c.height);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,washTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,washCanvas);
  gl.drawArrays(gl.TRIANGLES,0,6);
}

/* ---------- geometry helpers ---------- */
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
function parseFootprint(d){const n=d.replace(/[MCZ]/g,' $& ').trim().split(/[\s,]+/);let i=0,cur=null,start=null;const pts=[];
  while(i<n.length){const t=n[i++];if(t==='M'){cur=[+n[i++],+n[i++]];start=cur;pts.push(cur);}else if(t==='C'){while(i<n.length&&!/[MCZ]/.test(n[i])){const c1=[+n[i++],+n[i++]],c2=[+n[i++],+n[i++]],e=[+n[i++],+n[i++]];for(let s=1;s<=8;s++){const u=s/8,v=1-u;pts.push([v*v*v*cur[0]+3*v*v*u*c1[0]+3*v*u*u*c2[0]+u*u*u*e[0],v*v*v*cur[1]+3*v*v*u*c1[1]+3*v*u*u*c2[1]+u*u*u*e[1]]);}cur=e;}}else if(t==='Z'){}}
  return pts;}
function smoothPath(pts){if(pts.length<3)return '';let d=`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;for(let i=1;i<pts.length;i++)d+=` L${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;return d+' Z';}
function routePoints(m){const a=m.originCoordinates||INDEX.places.get(m.origin).coordinates,b=m.destinationCoordinates||INDEX.places.get(m.destination).coordinates,c=m.rendering?.control||[(a[0]+b[0])/2,(a[1]+b[1])/2];const out=[];for(let i=0;i<=48;i++){const t=i/48,u=1-t;out.push(P([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]]));}return out;}
// Tapered ribbon: wide tail, narrower neck, broad integrated head. One clean arc; no bends.
function ribbon(pts,tail,neck,headLen,headHalf){
  const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y));
  const total=L.at(-1);if(total<headLen*1.6)return null;const neckAt=total-headLen;let k=L.findIndex(v=>v>=neckAt);if(k<2)k=2;
  const nrm=i=>{const p=pts[Math.max(0,i-1)],q=pts[Math.min(pts.length-1,i+1)],dx=q.x-p.x,dy=q.y-p.y,l=Math.hypot(dx,dy)||1;return [-dy/l,dx/l];};
  const left=[],right=[];for(let i=0;i<=k;i++){const w=(tail+(neck-tail)*(L[i]/neckAt))/2,n=nrm(i);left.push([pts[i].x+n[0]*w,pts[i].y+n[1]*w]);right.push([pts[i].x-n[0]*w,pts[i].y-n[1]*w]);}
  const n=nrm(k),dx=pts.at(-1).x-pts[k].x,dy=pts.at(-1).y-pts[k].y,l=Math.hypot(dx,dy)||1,tip=[pts[k].x+dx/l*headLen,pts[k].y+dy/l*headLen];
  const poly=[...left,[pts[k].x+n[0]*headHalf,pts[k].y+n[1]*headHalf],tip,[pts[k].x-n[0]*headHalf,pts[k].y-n[1]*headHalf],...right.reverse()];
  return 'M'+poly.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L')+' Z';
}

/* ---------- timeline (same nonlinear weighting as Alpha 1.13) ---------- */
let years=[],positions=[],position=0,milestones=[],GROUPS=new Map();
function buildTimeline(){const cfg=DATA.timeline;let dist=0;years=[];positions=[];const dates=[...DATA.populations.flatMap(p=>(p.states||[]).map(s=>s.date)),...DATA.populationChanges.map(c=>c.startDate),...DATA.historicalEvents.map(e=>e.dateRange.start)];
  const movers=DATA.movements.filter(m=>canRenderMovement(m));
  for(let y=cfg.start;y<=cfg.end;y++){years.push(y);positions.push(dist);const move=Math.max(0,...movers.map(m=>fw(y,...movementWindow(m))));const change=Math.max(0,...dates.map(d=>Math.max(0,1-Math.abs(y-d)/cfg.changeRadius)));dist+=(cfg.earlyUntil!=null&&y<cfg.earlyUntil?cfg.earlyQuietWeight:cfg.quietWeight)+cfg.movementWeight*move+cfg.changeWeight*change;}
  const tot=positions.at(-1);positions=positions.map(p=>p/tot);}
const posForYear=y=>positions[Math.max(0,Math.min(years.length-1,Math.round(y)-DATA.timeline.start))];
function yearAt(pos){pos=Math.max(0,Math.min(1,pos));let lo=0,hi=positions.length-1;while(lo<hi){const m=(lo+hi)>>1;if(positions[m]<pos)lo=m+1;else hi=m;}if(lo===0)return years[0];const a=positions[lo-1],b=positions[lo];return years[lo-1]+(pos-a)/(b-a||1);}
// Cards come from the master Sheet (data/history.json "sheet" section: every card the loader kept, in Sheet order within a year).
// The engine records still draw the map (communities, arrows, symbols); they no longer decide which cards exist. Add ?engine=1 to the address to see the old engine card list.
let SHEETPLACES=new Map();
function sheetCardMilestones(){const sc=DATA.sheet?.cards;if(!sc?.length||/[?&]engine=1/.test(location.search))return null;
  SHEETPLACES=new Map((DATA.sheet.places||[]).map(p=>[p.id,p]));
  // A card dated before the timeline begins (Abraham, c. 2000 BCE) is placed at the first year of the timeline; its own date still shows on the card.
  return sc.map(c=>({record:c,type:'sheet',date:Math.max(DATA.timeline.start,Math.round(c.startYear))})).filter(m=>Number.isFinite(m.date)&&m.date<=DATA.timeline.end).sort((a,b)=>a.date-b.date);}
function buildMilestones(){milestones=[];GROUPS=new Map();const fromSheet=sheetCardMilestones();if(fromSheet){milestones=fromSheet;return;}const add=(col,type)=>{for(const r of col){const date=type==='movement'?(r.dateRange?.start??r.rendering?.window?.[1]):type==='event'?r.dateRange?.start:r.startDate;if(Number.isFinite(date)&&date>=DATA.timeline.start&&date<=DATA.timeline.end)milestones.push({record:r,type,date});}};
  add(DATA.populations,'population');add(DATA.movements,'movement');add(DATA.historicalEvents,'event');add(DATA.communityDestructions,'destruction');add(DATA.populationChanges,'change');milestones.sort((a,b)=>a.date-b.date);
  // One card per event. (1) Branches of one event (same title and date, e.g. the three Assyrian routes) share a single card; the card shows all branches.
  // (2) A destruction card replaces the community-change card about the same event (same title): destruction, murder and exile come first.
  GROUPS=new Map();const destroyed=new Set(milestones.filter(m=>m.type==='destruction').map(m=>m.record.title)),first=new Map();
  milestones=milestones.filter(m=>{if(m.type==='change'&&destroyed.has(m.record.title))return false;
    if(m.type==='movement'){const k=m.date+'|'+m.record.title,f=first.get(k);if(f){GROUPS.get(f.record).push(m.record);GROUPS.set(m.record,GROUPS.get(f.record));return false;}first.set(k,m);GROUPS.set(m.record,[m.record]);}return true;});
}
const sameCard=(r,q)=>!!r&&!!q&&(r===q||(GROUPS.get(r)||[]).includes(q));

/* ---------- state ---------- */
let trails=false,tour=null,selected=null,promptOpen=true,lastAutoIdx=-1;
const currentYear=()=>yearAt(position);

/* ---------- layout ---------- */
let ARC={cx:0,cy:0,r:0,a0:0,a1:0};
function layout(){
  const stage=$('stage'),w=stage.clientWidth,h=stage.clientHeight,narrow=w<620;
  const R=narrow?Math.max(100,Math.min(w*0.42,(h-80)/2)):Math.max(150,Math.min(w*0.44,h*0.43));
  view.baseR=R;view.R=R*view.zoom;view.cx=w/2;view.cy=narrow?R+18:Math.min(h/2-18,R+44);
  ARC={cx:view.cx,cy:view.cy,r:R+(narrow?18:34),a0:162*D2R,a1:18*D2R,w,h,narrow};
  $('ov').setAttribute('viewBox',`0 0 ${w} ${h}`);$('arc').setAttribute('viewBox',`0 0 ${w} ${h}`);
  drawArcStatic();render();
}

/* ---------- arc timeline ---------- */
const arcAngle=pos=>ARC.a0+(ARC.a1-ARC.a0)*pos;
const arcPt=(pos,dr=0)=>{const a=arcAngle(pos);return [ARC.cx+(ARC.r+dr)*Math.cos(a),ARC.cy+(ARC.r+dr)*Math.sin(a)];};
function arcD(p0,p1,dr=0){const a=arcPt(p0,dr),b=arcPt(p1,dr);const large=Math.abs(arcAngle(p1)-arcAngle(p0))>Math.PI?1:0;return `M${a[0].toFixed(1)},${a[1].toFixed(1)} A${ARC.r+dr},${ARC.r+dr} 0 ${large} 0 ${b[0].toFixed(1)},${b[1].toFixed(1)}`;}
function drawArcStatic(){
  const g=$('arcStatic');g.replaceChildren();
  el('path',{d:arcD(0,1),class:'arcHalo'},g);el('path',{d:arcD(0,1),class:'arcTrack'},g);el('path',{d:arcD(0,1),class:'arcHit',id:'arcHit'},g);
  const seen=new Set();
  milestones.forEach((m,i)=>{if(seen.has(m.date))return;seen.add(m.date);const [x,y]=arcPt(posForYear(m.date));const c=el('circle',{cx:x,cy:y,r:3,class:'notch'},g);c.dataset.i=i;});
  const placed=[];const lateYears=DATA.timeline.end>200?[...DATA.eras.filter(e=>e.startDate>200).map(e=>e.startDate)]:[];for(const yr of [-2000,-1300,-1208,-722,-586,-539,-332,-205,-63,70,117,200,...lateYears]){const pos=posForYear(yr),[x,y]=arcPt(pos,ARC.narrow?16:22),a=arcAngle(pos);if(x<44||x>ARC.w-44)continue;if(placed.some(([px,py])=>Math.hypot(px-x,py-y)<46)&&yr!==200&&yr!==-1300)continue;if(yr!==200&&Math.hypot(x-arcPt(1,22)[0],y-arcPt(1,22)[1])<46)continue;placed.push([x,y]);const t=el('text',{x,y,class:'tick','text-anchor':Math.cos(a)<-0.3?'end':Math.cos(a)>0.3?'start':'middle','dominant-baseline':Math.sin(a)>0.5?'hanging':'middle'},g);t.textContent=yearLabel(yr).replace(' / 1 CE','');const bb=t.getBBox();if(bb.x<4)t.setAttribute('x',x+4-bb.x);else if(bb.x+bb.width>ARC.w-4)t.setAttribute('x',x-(bb.x+bb.width-ARC.w+4));}
}
function drawArcLive(){const g=$('arcLive');g.replaceChildren();el('path',{d:arcD(0,Math.max(0.0001,position)),class:'arcFill'},g);const [x,y]=arcPt(position);el('circle',{cx:x,cy:y,r:11,class:'bead'},g);const s=$('arcSlider');s.setAttribute('aria-valuenow',Math.round(currentYear()));s.setAttribute('aria-valuetext',yearLabel(Math.round(currentYear())));}
function posFromPointer(e){const r=$('arc').getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let a=Math.atan2(y-ARC.cy,x-ARC.cx);if(a<-Math.PI/2)a+=2*Math.PI;const p=(a-ARC.a0)/(ARC.a1-ARC.a0);return Math.max(0,Math.min(1,p));}

/* ---------- camera ---------- */
function followCamera(y){if(view.manual)return;const s=DATA.cameraStates;let i=0;while(i+1<s.length&&s[i+1].startDate<=y)i++;const a=s[i],b=s[Math.min(i+1,s.length-1)],span=b.startDate-a.startDate,t=span>0?Math.min(1,Math.max(0,(y-a.startDate)/span)):0,e=t*t*(3-2*t),mix=k=>a[k]+(b[k]-a[k])*e;
  const [lon,lat]=svgToLonLat([mix('centerX'),mix('centerY')]);view.lon=lon;view.lat=lat;view.deg=Math.max(10,Math.min(45,26/mix('scale')));}

/* ---------- symbols ---------- */
// Community symbols (locked 2 Oct 2026, Map-Icon-Decisions): shape + color carry the meaning, never color alone.
// Murdered community = red octagon; forced conversion = purple diamond; forced conversion to Christianity = split diamond (half star, half cross).
const SYM_SHAPE={octagon:'M15.71,6.51 L6.51,15.71 L-6.51,15.71 L-15.71,6.51 L-15.71,-6.51 L-6.51,-15.71 L6.51,-15.71 L15.71,-6.51 Z',diamond:'M0,-17.4 L17.4,0 L0,17.4 L-17.4,0 Z',square:'M-13,-13 H13 V13 H-13 Z'};
const SYM_CREAM='#FFF3DC',SYM_PURPLE='#5A3B7A';let symClip=0;
function hexagram(r){const h=(r*.866).toFixed(2),q=(r/2).toFixed(2);return `M0,${-r} L${h},${q} L-${h},${q} Z M0,${r} L-${h},-${q} L${h},-${q} Z`;}
function drawSymbol(inner,kind,record){const outline={class:'symShape',stroke:'#1B2328','stroke-width':1.2,'stroke-linejoin':'round'},star={fill:'none',stroke:SYM_CREAM,'stroke-width':1.6,'stroke-linejoin':'round'};
  if(kind==='noLonger'){el('path',{...outline,d:SYM_SHAPE.square,fill:'#20272B'},inner);el('path',{...star,d:hexagram(10.4)},inner);return;}
  if(kind==='destroyed'){el('path',{...outline,d:SYM_SHAPE.octagon,fill:'#8C2A24'},inner);el('path',{...star,d:hexagram(10.4)},inner);return;}
  if(record?.conversionReligion!=='Christianity'){el('path',{...outline,d:SYM_SHAPE.diamond,fill:SYM_PURPLE},inner);el('path',{...star,d:hexagram(8.4)},inner);return;}
  const L='symClip'+(++symClip),R='symClip'+(++symClip),defs=el('defs',{},inner);el('rect',{x:-20,y:-20,width:20,height:40},el('clipPath',{id:L},defs));el('rect',{x:0,y:-20,width:20,height:40},el('clipPath',{id:R},defs));
  el('path',{d:SYM_SHAPE.diamond,fill:SYM_PURPLE,'clip-path':`url(#${L})`},inner);el('path',{d:SYM_SHAPE.diamond,fill:SYM_CREAM,'clip-path':`url(#${R})`},inner);el('path',{...outline,d:SYM_SHAPE.diamond,fill:'none'},inner);
  el('path',{...star,d:hexagram(10.6),'clip-path':`url(#${L})`},inner);el('path',{d:'M1,-10.6 V10.6 M1,-3.6 H9.2',fill:'none',stroke:SYM_PURPLE,'stroke-width':1.8,'stroke-linecap':'square'},inner);}
function communitySymbol(parent,kind,size,record){const g=el('g',{class:'sym'},parent);const inner=el('g',{transform:`scale(${size/36})`},g);drawSymbol(inner,kind,record);return g;}

/* ---------- render ---------- */
const COLORS={'#a33b32':['#D2463A','#8E1F18'],'#275d9b':['#3D82D4','#174E92'],'#6d6256':['#565C60','#2C3033']};
function render(){
  if(!DATA)return;const y=currentYear(),frame=computeFrame(y),dy=Math.round(y);
  followCamera(y);
  const ov=$('ov'),scale=(view.baseR/390)*Math.min(1.6,Math.sqrt(view.zoom));const layers={geo:$('lGeo'),route:$('lRoute'),mark:$('lMark'),label:$('lLabel')};for(const k in layers)layers[k].replaceChildren();
  const st0=$('stage'),WS=0.5;washCanvas.width=Math.max(2,Math.round(st0.clientWidth*WS));washCanvas.height=Math.max(2,Math.round(st0.clientHeight*WS));wctx.clearRect(0,0,washCanvas.width,washCanvas.height);
  const pxPerDeg=view.R*(90/view.deg)*D2R,washBlur=Math.max(6,Math.min(48,pxPerDeg*0.7))*WS;
  // population wash and anchors
  const labels=[];drawGeo(layers.geo);
  for(const st of frame.populations){const p=DATA.populations.find(r=>r.id===st.id);if(!st.visible||st.intensity<=0.01)continue;
    if(p.geographicFootprint){const pts=parseFootprint(p.geographicFootprint).map(P);if(pts.some(q=>q.vis)){const a=Math.min(.95,st.intensity*1.15)*(st.uncertain?.6:1);wctx.save();wctx.shadowColor=`rgba(0,0,0,${a.toFixed(3)})`;wctx.shadowBlur=washBlur*2;wctx.shadowOffsetX=20000;wctx.beginPath();pts.forEach((q,i)=>{const x=q.x*WS-20000,y=q.y*WS;i?wctx.lineTo(x,y):wctx.moveTo(x,y);});wctx.closePath();wctx.fillStyle='#000';wctx.fill();wctx.restore();}}
    const r=p.rendering||{};if(r.node&&st.nodeOpacity>0.05&&p.coordinates){const q=P(p.coordinates);if(!q.vis)continue;const isSel=selected&&(isCardOf(p)||selected.record===p||selected.record.populationId===p.id||(selected.type==='movement'&&[selected.record.origin,selected.record.destination].includes(p.place)));const g=el('g',{class:'anchor'+(st.uncertain?' uncertain':'')+(isSel?' selected':''),transform:`translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`,opacity:Math.max(.35,st.nodeOpacity).toFixed(2),tabindex:0,role:'button','aria-label':p.title},layers.mark);if(r.ring)el('circle',{r:9*Math.max(.8,scale),class:'ring'},g);el('circle',{r:4.6*Math.max(.8,scale),class:'dot'},g);g.addEventListener('click',()=>{if(!dragMoved)openStory(p,'population');});g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openStory(p,'population');}});
      if(r.label&&st.nodeOpacity>.08)labels.push({text:r.label,x:q.x,y:q.y,side:r.labelSide||'right',prio:['j','b','alexNode','israel'].includes(p.id)?2:1,record:p});}
  }
  // movement routes
  const defs=$('ovDefs');defs.querySelectorAll('.dyn').forEach(n=>n.remove());
  for(const fm of frame.movements){if(!fm.visible)continue;const m=DATA.movements.find(r=>r.id===fm.id);const win=movementWindow(m),past=trails&&win[1]<=y;const op=Math.max(fm.opacity,past?.28:0);if(op<=.01)continue;
    const pts=routePoints(m).filter(q=>q.vis);if(pts.length<6)continue;const traditional=m.evidenceStatus==='traditional account';
    const d=ribbon(pts,(traditional?13:15)*scale,7.5*scale,24*scale,15*scale);if(!d)continue;
    const g=el('g',{class:'route',opacity:op.toFixed(3),tabindex:0,role:'button','aria-label':m.title},layers.route);
    if(traditional){el('path',{d,class:'routeTrad'},g);}
    else{const [c1,c2]=COLORS[fm.color]||COLORS['#6d6256'];const gid='rg-'+m.id;const lg=el('linearGradient',{id:gid,class:'dyn',x1:0,y1:0,x2:0,y2:1},defs);el('stop',{offset:0,'stop-color':c1},lg);el('stop',{offset:1,'stop-color':c2},lg);
      el('path',{d,class:'routeShadow',transform:`translate(${2*scale} ${3.5*scale})`},g);el('path',{d,fill:`url(#${gid})`,class:'routeBody'+(m.contested?' contested':'')},g);}
    if(sameCard(selected?.record,m)||isCardOf(m))g.classList.add('selected');g.addEventListener('click',()=>{if(!dragMoved)openStory(m,'movement');});g.addEventListener('keydown',e=>{if(e.key==='Enter'){openStory(m,'movement');}});}
  // historical events (e.g. Lachish)
  for(const fe of frame.events){if(fe.opacity<=.02)continue;const e=DATA.historicalEvents.find(r=>r.id===fe.id);const pl=INDEX.places.get(e.place);const q=P(pl?.coordinates||e.rendering.position);if(!q.vis)continue;const g=el('g',{class:'event',transform:`translate(${q.x} ${q.y})`,opacity:fe.opacity.toFixed(2),tabindex:0,role:'button','aria-label':e.title},layers.mark);el('rect',{x:-5,y:-5,width:10,height:10,transform:'rotate(45)',class:'eventMark'},g);g.addEventListener('click',()=>{if(!dragMoved)openStory(e,'event');});if(e.rendering?.label)labels.push({text:e.rendering.label,x:q.x,y:q.y,side:'below',prio:0,record:e});}
  // community symbols: anchored at the community's own place
  const symSize=Math.max(30,40*scale),obstacles=[];
  for(const fd of frame.destructions){const c=DATA.communityDestructions.find(r=>r.id===fd.id),past=trails&&c.startDate<=y;if(!fd.visible&&!past)continue;const pop=DATA.populations.find(p=>p.id===c.populationId);const q=P(pop?.coordinates||INDEX.places.get(c.place).coordinates);if(!q.vis)continue;
    const g=communitySymbol(layers.mark,'destroyed',symSize);const sx=q.x+symSize*.62,sy=q.y-symSize*.62;obstacles.push({x:sx-symSize/2,y:sy-symSize/2,w:symSize,h:symSize});g.setAttribute('transform',`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);g.setAttribute('opacity',fd.visible?1:.5);g.setAttribute('tabindex',0);g.setAttribute('role','button');g.setAttribute('aria-label',c.title);if(selected?.record===c||isCardOf(c))g.classList.add('selected');g.addEventListener('click',()=>{if(!dragMoved)openStory(c,'destruction');});}
  // "Community no longer exists": black square at the place, from its year. Display window (a design choice, not history): full for 20 years, fading out by 30.
  for(const c of (DATA.sheet?.communities||[])){if(c.mapSymbol?.kind!=='blackSquare'||/[?&]engine=1/.test(location.search))continue;const pp=SHEETPL.get(c.placeId);if(!Number.isFinite(pp?.lat))continue;const age=y-c.startYear,past=trails&&age>=0;let op=age<0?0:age<=20?1:Math.max(0,1-(age-20)/10);if(past)op=Math.max(op,.5);if(op<=.01)continue;
    const q=P([(pp.lon+15)*15,(58-pp.lat)*650/53]);if(!q.vis)continue;const g=communitySymbol(layers.mark,'noLonger',symSize);const sx=q.x+symSize*.62,sy=q.y-symSize*.62;obstacles.push({x:sx-symSize/2,y:sy-symSize/2,w:symSize,h:symSize});g.setAttribute('transform',`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);g.setAttribute('opacity',op.toFixed(2));g.setAttribute('tabindex',0);g.setAttribute('role','button');g.setAttribute('aria-label','Community no longer exists: '+(pp.historicalName||c.placeId)+', '+c.dateDisplay);
    const card=DATA.sheet.cards.find(k=>k.id===c.id);if(card){if(selected?.record===card)g.classList.add('selected');g.addEventListener('click',()=>{if(!dragMoved)openStory(card,'sheet');});}}
  for(const c of DATA.populationChanges){if(!canRenderConversion(c))continue;const vis=activeAt(c,y),past=trails&&c.startDate<=y;if(!vis&&!past)continue;const pop=DATA.populations.find(p=>p.id===c.populationId);const q=P(pop.coordinates);if(!q.vis)continue;const g=communitySymbol(layers.mark,'converted',symSize,c);g.setAttribute('transform',`translate(${(q.x+symSize*.62).toFixed(1)} ${(q.y-symSize*.62).toFixed(1)})`);g.setAttribute('opacity',vis?1:.5);g.addEventListener('click',()=>openStory(c,'change'));}
  addSheetPlaceLabels(frame,labels,layers.mark,P,scale);
  drawGlobe();
  const boxes=placeLabels(labels,layers.label,scale,obstacles);for(const l of geoLabels()){const fs=l.kind==='waterLabel'?13:11,w=l.text.length*fs*(l.kind==='waterLabel'?0.55:0.78),h=fs*1.2,b={x:l.x-w/2,y:l.y-h,w,h};if(boxes.some(o=>b.x<o.x+o.w&&b.x+b.w>o.x&&b.y<o.y+o.h&&b.y+b.h>o.y))continue;boxes.push(b);const t=el('text',{x:l.x.toFixed(1),y:l.y.toFixed(1),'text-anchor':'middle',class:l.kind==='waterLabel'?'seaName':'regionName'},layers.label);t.textContent=l.kind==='waterLabel'?l.text:l.text.toUpperCase();}
  // panel
  $('year').innerHTML=dy<0?`${Math.abs(dy)}<span>BCE</span>`:`${Math.abs(dy)}`;   // project rule: CE years are the bare year$('era').textContent=eraLabel(y,frame);
  drawArcLive();
  
  // (if the user turned the globe and then moved the timeline, turnToRecord brings the action into view)
  const idx=lastMilestoneIdx(dy);if(!selected){if(idx!==lastAutoIdx){lastAutoIdx=idx;if(idx>=0){fillStory(milestones[idx].record,milestones[idx].type,false);turnToRecord(milestones[idx].record,milestones[idx].type);}}}
}
function drawGeo(g){if(!GEO)return;const line=(pts,cls)=>{let d='',pen=false;for(const [lo,la] of pts){const q=project(lo,la);if(!q.vis){pen=false;continue;}d+=(pen?' L':' M')+q.x.toFixed(1)+','+q.y.toFixed(1);pen=true;}if(d)el('path',{d,class:cls},g);};
  for(const c of GEO.coast)line(c,'coast');for(const r of GEO.rivers)line(r,'river');}
function geoLabels(){if(!GEO)return [];const out=[];for(const [text,kind,lo,la] of GEO.labels){const q=project(lo,la);if(q.vis&&q.depth<1.05)out.push({text,x:q.x,y:q.y,kind});}return out;}
// Step d: names for Sheet Places. Only places that a visible arrow starts or ends at, or that the open Sheet card sits on, and only when no
// label with the same name is already queued; camera-only Places (place-cam-*) are never drawn.
function addSheetPlaceLabels(frame,labels,mark,P,scale){
  if(!SHEETPL.size)return;
  const want=new Set();for(const fm of frame.movements){if(!fm.visible||fm.opacity<.3)continue;const m=DATA.movements.find(r=>r.id===fm.id);if(!m)continue;for(const id of [m.origin,m.destination])if(typeof id==='string')want.add(id);}
  const sp=selected?.record?.placeId;if(typeof sp==='string')want.add(sp);
  const have=new Set(labels.map(l=>String(l.text).toLowerCase()));
  for(const id of want){const pl=SHEETPL.get(id);if(!pl||pl.cameraOnly||pl.lat==null||pl.lon==null)continue;const text=String(pl.historicalName||'').split(/\s*[\/(]/)[0].trim();if(!text||have.has(text.toLowerCase()))continue;
    const q=P([(pl.lon+15)*15,(58-pl.lat)*650/53]);if(!q.vis)continue;have.add(text.toLowerCase());
    el('circle',{cx:q.x.toFixed(1),cy:q.y.toFixed(1),r:(3.4*Math.max(.8,scale)).toFixed(1),fill:'#1A1410',stroke:'#FFF2DE','stroke-width':2,'pointer-events':'none'},mark);
    labels.push({text,x:q.x,y:q.y,side:'right',prio:1});}
}
function placeLabels(list,parent,scale,obstacles=[]){const boxes=[...obstacles];const fs=Math.max(12,15*Math.min(1.15,scale));list.sort((a,b)=>b.prio-a.prio);
  for(const l of list){const w=l.text.length*fs*0.56,h=fs*1.1;const cand=l.side==='left'?[['end',-12,4],['start',12,4],['middle',0,fs+10]]:l.side==='below'?[['middle',0,fs+10],['start',12,4],['end',-12,4]]:[['start',12,4],['end',-12,4],['middle',0,fs+10],['middle',0,-14]];
    let placed=null;for(const [anchor,dx,dy] of cand){const x0=anchor==='start'?l.x+dx:anchor==='end'?l.x+dx-w:l.x-w/2,y0=l.y+dy-h*.8;const b={x:x0,y:y0,w,h};if(!boxes.some(o=>b.x<o.x+o.w&&b.x+b.w>o.x&&b.y<o.y+o.h&&b.y+b.h>o.y)){placed=[anchor,l.x+dx,l.y+dy];boxes.push(b);break;}}
    if(!placed&&l.prio>=2)placed=[cand[0][0],l.x+cand[0][1],l.y+cand[0][2]];if(!placed)continue;
    const t=el('text',{x:placed[1].toFixed(1),y:placed[2].toFixed(1),'text-anchor':placed[0],class:'label','font-size':fs.toFixed(1)},parent);t.textContent=l.text;}return boxes;}
function lastMilestoneIdx(y){let idx=-1;for(let i=0;i<milestones.length;i++)if(milestones[i].date<=y)idx=i;return idx;}

/* ---------- story ---------- */
// An engine map object that has a Sheet card (DATA.cardLinks) opens that card; the object lights up while its card is open.
const isCardOf=r=>selected?.type==='sheet'&&DATA.cardLinks?.[r.id]===selected.record.id;
function openStory(record,type){if(type!=='sheet'&&milestones[0]?.type==='sheet'){const cid=DATA.cardLinks?.[record.id],m=cid&&milestones.find(x=>x.record.id===cid);if(m){record=m.record;type='sheet';}}stopTour();dismissPrompt();selected={record,type};fillStory(record,type,true);render();if(window.innerWidth<=900)$('panel').scrollTo({top:0,behavior:'smooth'});}
function fillStory(record,type,user){const kind=type==='sheet'?record.type:{movement:'Movement',population:'Community',change:'Community',destruction:'Event',event:'Event'}[type]||'';
  $('storyKicker').textContent=kind+(type==='sheet'&&record.status==='draft'?' · Draft':'');$('storyDate').textContent=record.date||'';$('storyTitle').textContent=record.title||record.historicalPlaceName||'';$('storyText').textContent=type==='sheet'?record.description||'':record.story||'';
  const mw=kind==='Event'&&record.meanwhile;$('storyMeanwhile').hidden=!mw;$('storyMeanwhileText').textContent=mw?' '+record.meanwhile:'';
  $('closeStory').hidden=!user;$('story').classList.toggle('pinned',!!user);}
function openSources(){const list=$('allSources');if(!list.childElementCount){for(const src of [...DATA.sources].sort((a,b)=>(a.title||'').localeCompare(b.title||''))){const row=document.createElement('li');const a=document.createElement(src.url?'a':'span');if(src.url){a.href=src.url;a.target='_blank';a.rel='noopener';}a.textContent=src.title||src.id;row.appendChild(a);if(src.supports){const sm=document.createElement('small');sm.textContent=src.supports;row.appendChild(sm);}list.appendChild(row);}}$('sourcesDlg').hidden=false;$('sourcesClose').focus();}
function closeStory(){selected=null;lastAutoIdx=-1;render();}

/* ---------- playback ---------- */
function setPos(p){position=Math.max(0,Math.min(1,p));render();}
function setYearExact(y){position=posForYear(y);render();}
function startTour(){stopTour();dismissPrompt();selected=null;lastAutoIdx=-1;view.manual=false;view.zoom=1;view.R=view.baseR;if(position>=0.999)position=posForYear(DATA.presentation?.openingYear??DATA.timeline.start);const from=position,dur=DATA.presentation?.tourDurationMs||20000,t0=performance.now();
  const step=now=>{position=Math.min(1,from+(now-t0)/dur*(1-from));render();if(position>=1){stopTour();return;}tour=requestAnimationFrame(step);};tour=requestAnimationFrame(step);setPlayUI(true);}
function stopTour(){if(tour!=null)cancelAnimationFrame(tour);tour=null;cancelTurn();setPlayUI(false);}
// Play and Pause are drawn shapes in the same style (black, same height and weight), never text characters.
const ICO_PLAY='M3.5,1.5 L13.5,8 L3.5,14.5 Z',ICO_PAUSE='M3.5,1.5 H6.5 V14.5 H3.5 Z M9.5,1.5 H12.5 V14.5 H9.5 Z';
function setPlayUI(playing){$('playIco').setAttribute('d',playing?ICO_PAUSE:ICO_PLAY);$('playLbl').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-pressed',String(playing));}

/* ---------- turn the globe to a card's place (Previous / Next) ---------- */
// Once the user has dragged or zoomed, the globe no longer follows the story by itself (view.manual). Previous / Next then
// turn it, smoothly, so the card's place is in view. The user's zoom is kept unless the place would not fit.
let turnAnim=null;
function cancelTurn(){if(turnAnim!=null)cancelAnimationFrame(turnAnim);turnAnim=null;}
function recordPlaces(record,type){const pl=id=>INDEX.places.get(id)?.coordinates;
  if(type==='movement'){const g=GROUPS.get(record)||[record];return [g[0].originCoordinates||pl(g[0].origin),...g.map(r=>r.destinationCoordinates||pl(r.destination))].filter(Boolean);}
  if(type==='event')return [pl(record.place)||record.rendering?.position].filter(Boolean);
  const pop=DATA.populations.find(p=>p.id===(type==='population'?record.id:record.populationId));
  return [type==='population'?record.coordinates||pl(record.place):pop?.coordinates||pl(pop?.place)||pl(record.place)].filter(Boolean);}
function meanLonLat(pts){let x=0,y=0,z=0;for(const [lo,la] of pts){const a=lo*D2R,b=la*D2R;x+=Math.cos(b)*Math.cos(a);y+=Math.cos(b)*Math.sin(a);z+=Math.sin(b);}return [Math.atan2(y,x)/D2R,Math.atan2(z,Math.hypot(x,y))/D2R];}
function placesFit(pts,s){const keep={lon:view.lon,lat:view.lat,zoom:view.zoom,R:view.R,deg:view.deg};Object.assign(view,{lon:s.lon,lat:s.lat,zoom:s.zoom,R:view.baseR*s.zoom,deg:s.deg});
  const st=$('stage'),w=st.clientWidth,h=st.clientHeight,m=Math.min(44,w*.08);const ok=pts.every(([lo,la])=>{const q=project(lo,la);return q.vis&&q.depth<1&&q.x>=m&&q.x<=w-m&&q.y>=m&&q.y<=h-m;});Object.assign(view,keep);return ok;}
function recordLonLats(record,type){if(type==='sheet'){const p=SHEETPLACES.get(record.placeId);return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)?[[p.lon,p.lat]]:[];}return recordPlaces(record,type).map(svgToLonLat);}
function turnToRecord(record,type){
  if(!view.manual)return;cancelTurn();                       // the story camera is still in charge and already follows the story
  const pts=recordLonLats(record,type);if(!pts.length)return;
  const [lon,lat]=pts.length>1?meanLonLat(pts):pts[0];const to={lon,lat:Math.max(-70,Math.min(80,lat)),zoom:view.zoom,deg:view.deg};
  if(!placesFit(pts,to)){while(to.zoom>ZMIN+.01&&!placesFit(pts,to))to.zoom=Math.max(ZMIN,to.zoom*.9);   // first zoom out to the default,
    while(to.deg<45&&!placesFit(pts,to))to.deg=Math.min(45,to.deg*1.12);}                                // then show more of the globe
  const from={lon:view.lon,lat:view.lat,zoom:view.zoom,deg:view.deg},dl=(((to.lon-from.lon+180)%360)+360)%360-180;
  const set=e=>{view.lon=from.lon+dl*e;view.lat=from.lat+(to.lat-from.lat)*e;view.deg=from.deg+(to.deg-from.deg)*e;view.zoom=from.zoom+(to.zoom-from.zoom)*e;view.R=view.baseR*view.zoom;render();};
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){set(1);return;}
  const t0=performance.now(),ms=800,tick=now=>{const t=Math.min(1,(now-t0)/ms);set(t*t*(3-2*t));turnAnim=t<1?requestAnimationFrame(tick):null;};turnAnim=requestAnimationFrame(tick);}
function dismissPrompt(){if(!promptOpen)return;promptOpen=false;$('prompt').hidden=true;$('panel').classList.remove('inviting');$('play').hidden=false;$('options').hidden=false;}
function reset(){stopTour();dismissPrompt();selected=null;lastAutoIdx=-1;position=0;view.manual=true;const j=svgToLonLat(INDEX.places.get('place-j').coordinates);view.lon=j[0];view.lat=j[1];view.deg=15;setZoom(1);}

/* ---------- interaction ---------- */
let dragMoved=false;
function initInteraction(){
  const stage=$('ov');const ptrs=new Map();let last=null,pinch=null;
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('.route,.anchor,.sym,.event,.wash'))dragMoved=false;ptrs.set(e.pointerId,[e.clientX,e.clientY]);dragMoved=false;last=[e.clientX,e.clientY];if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),zoom:view.zoom};}});
  stage.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,[e.clientX,e.clientY]);
    if(ptrs.size===2&&pinch){if(gesture)return;const [a,b]=[...ptrs.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);dragMoved=true;stopTour();const r0=$('ov').getBoundingClientRect();setZoom(pinch.zoom*d/pinch.d,(a[0]+b[0])/2-r0.left,(a[1]+b[1])/2-r0.top);return;}
    const dx=e.clientX-last[0],dy=e.clientY-last[1];if(Math.abs(dx)+Math.abs(dy)<1)return;if(!dragMoved&&Math.hypot(e.clientX-last[0],e.clientY-last[1])<3)return;if(!dragMoved)try{stage.setPointerCapture(e.pointerId);}catch(_){}dragMoved=true;last=[e.clientX,e.clientY];
    const k=90/view.deg,degPerPx=1/(view.R*k)/D2R;view.lat=Math.max(-70,Math.min(80,view.lat+dy*degPerPx));view.lon-=dx*degPerPx/Math.max(.2,Math.cos(view.lat*D2R));view.manual=true;stopTour();dismissPrompt();render();});
  stage.addEventListener('click',e=>{if(dragMoved||e.target.closest('.route,.anchor,.sym,.event'))return;if(tour==null)return;stopTour();const i=lastMilestoneIdx(Math.round(currentYear()));if(i<0)return;const m=milestones[i];selected={record:m.record,type:m.type};fillStory(m.record,m.type,true);render();if(window.innerWidth<=900)$('panel').scrollTo({top:0,behavior:'smooth'});});
  let gesture=null;
  stage.addEventListener('touchmove',e=>{e.preventDefault();},{passive:false});
  stage.addEventListener('gesturestart',e=>{e.preventDefault();gesture={zoom:view.zoom};stopTour();},{passive:false});
  stage.addEventListener('gesturechange',e=>{e.preventDefault();if(!gesture)return;const r0=stage.getBoundingClientRect();dragMoved=true;setZoom(gesture.zoom*e.scale,(e.clientX||r0.width/2+r0.left)-r0.left,(e.clientY||r0.height/2+r0.top)-r0.top);},{passive:false});
  stage.addEventListener('gestureend',e=>{e.preventDefault();gesture=null;setTimeout(()=>{dragMoved=false;},0);},{passive:false});
  const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;setTimeout(()=>{dragMoved=false;},0);};stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
  stage.addEventListener('wheel',e=>{e.preventDefault();stopTour();const r0=stage.getBoundingClientRect();setZoom(view.zoom*Math.exp(-e.deltaY*0.0018),e.clientX-r0.left,e.clientY-r0.top);},{passive:false});
  // arc slider
  const arc=$('arcHit');let scrubbing=false;
  const scrub=e=>{stopTour();dismissPrompt();selected=null;setPos(posFromPointer(e));};
  $('arc').addEventListener('pointerdown',e=>{if(!e.target.closest('#arcHit,.bead,.notch'))return;scrubbing=true;$('arc').setPointerCapture?.(e.pointerId);const n=e.target.closest('.notch');if(n){selectMilestone(+n.dataset.i);return;}scrub(e);});
  $('arc').addEventListener('pointermove',e=>{if(scrubbing)scrub(e);});$('arc').addEventListener('pointerup',()=>{scrubbing=false;});$('arc').addEventListener('pointercancel',()=>{scrubbing=false;});
  const arcTouch=e=>{const t=e.touches[0];if(!t)return;stopTour();dismissPrompt();selected=null;setPos(posFromPointer(t));};
  $('arc').addEventListener('touchstart',e=>{if(!e.target.closest('#arcHit,.bead'))return;e.preventDefault();scrubbing=true;arcTouch(e);},{passive:false});
  $('arc').addEventListener('touchmove',e=>{if(!scrubbing)return;e.preventDefault();arcTouch(e);},{passive:false});
  $('arc').addEventListener('touchend',()=>{scrubbing=false;});$('arc').addEventListener('touchcancel',()=>{scrubbing=false;});
  $('arcSlider').addEventListener('keydown',e=>{const y=Math.round(currentYear());let n=null;if(e.key==='ArrowRight'||e.key==='ArrowUp')n=y+(e.shiftKey?25:1);if(e.key==='ArrowLeft'||e.key==='ArrowDown')n=y-(e.shiftKey?25:1);if(e.key==='Home')n=DATA.timeline.start;if(e.key==='End')n=DATA.timeline.end;if(e.key==='PageUp'){step(1);e.preventDefault();return;}if(e.key==='PageDown'){step(-1);e.preventDefault();return;}if(n!=null){e.preventDefault();stopTour();dismissPrompt();selected=null;setYearExact(Math.max(DATA.timeline.start,Math.min(DATA.timeline.end,n)));}});
  $('play').addEventListener('click',()=>tour!=null?stopTour():startTour());$('introPlay').addEventListener('click',startTour);
  $('introExplore').addEventListener('click',()=>{dismissPrompt();$('arcSlider').focus();$('arcWrap').classList.add('attention');setTimeout(()=>$('arcWrap').classList.remove('attention'),2600);});
  $('reset').addEventListener('click',reset);
  $('prev').addEventListener('click',()=>step(-1));$('next').addEventListener('click',()=>step(1));
  $('closeStory').addEventListener('click',closeStory);$('sourcesLink').addEventListener('click',openSources);$('sourcesClose').addEventListener('click',()=>{$('sourcesDlg').hidden=true;$('sourcesLink').focus();});
  for(const b of document.querySelectorAll('[data-trails]'))b.addEventListener('click',()=>{trails=b.dataset.trails==='on';for(const o of document.querySelectorAll('[data-trails]'))o.setAttribute('aria-pressed',String(o===b));render();});
  $('keyBtn').addEventListener('click',()=>{const k=$('key');k.hidden=!k.hidden;$('keyBtn').setAttribute('aria-expanded',String(!k.hidden));});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('sourcesDlg').hidden){$('sourcesDlg').hidden=true;return;}if(!$('key').hidden){$('key').hidden=true;return;}if(promptOpen){dismissPrompt();return;}if(selected)closeStory();}});
  window.addEventListener('resize',()=>requestAnimationFrame(layout));
}
function step(dir){const y=Math.round(currentYear());let i=selected?milestones.findIndex(m=>m.type===selected.type&&sameCard(m.record,selected.record)):-1;   // from the open card, go to the next / previous card (cards that share a year are all reached)
  if(i<0){i=lastMilestoneIdx(y);if(dir>0){i=milestones.findIndex(m=>m.date>y);if(i<0)return;}else{while(i>=0&&milestones[i].date>=y)i--;if(i<0)return;}}
  else{i+=dir;if(i<0||i>=milestones.length)return;}
  selectMilestone(i);}
function selectMilestone(i){const m=milestones[i];if(!m)return;stopTour();dismissPrompt();position=posForYear(m.date);selected={record:m.record,type:m.type};fillStory(m.record,m.type,true);render();turnToRecord(m.record,m.type);if(window.innerWidth<=900)$('panel').scrollTo({top:0,behavior:'smooth'});}

/* ---------- boot ---------- */

// Sheet arrows: Movements with both ends ready are added to the engine's movement list so they use the same drawing, fading and timeline code.
// Movements that an engine arrow already draws (same Event ID) are skipped, so nothing is drawn twice.
function addSheetMovements(){
  const S=DATA.sheet;if(!S?.movements?.length||/[?&]engine=1/.test(location.search))return;
  const pl=new Map((S.places||[]).map(p=>[p.id,p]));SHEETPL=pl;
  const covered=new Set(DATA.movements.map(m=>DATA.cardLinks?.[m.id]).filter(Boolean));
  const xy=p=>[(p.lon+15)*15,(58-p.lat)*650/53];
  const ok=m=>m.arrowEndsReady&&!covered.has(m.eventId)&&[m.originPlaceId,m.destinationPlaceId].every(id=>Number.isFinite(pl.get(id)?.lat)&&Number.isFinite(pl.get(id)?.lon));
  const ready=new Map(S.movements.filter(ok).map(m=>[m.id,m]));
  // Branch rule (dataset chat): the New Amsterdam arrow (23 refugees) draws only together with the Amsterdam, Curacao and Barbados branches.
  const needs={'MOV-055':['MOV-052','MOV-053','MOV-054']};
  for(const [id,req] of Object.entries(needs))if(ready.has(id)&&!req.every(r=>ready.has(r)))ready.delete(id);
  const sib=new Map();for(const m of ready.values()){const k=(m.eventId||m.id)+'|'+m.originPlaceId;(sib.get(k)||sib.set(k,[]).get(k)).push(m.id);}
  const added=[];
  for(const m of ready.values()){
    const a=xy(pl.get(m.originPlaceId)),b=xy(pl.get(m.destinationPlaceId)),grp=sib.get((m.eventId||m.id)+'|'+m.originPlaceId),i=grp.indexOf(m.id);
    const bend=grp.length>1?(i-(grp.length-1)/2)*0.22:0.12,dx=b[0]-a[0],dy=b[1]-a[1];
    const control=[(a[0]+b[0])/2-dy*bend,(a[1]+b[1])/2+dx*bend];
    const t=m.arrowTreatment||'',color=/^Red/.test(t)?'#a33b32':/^Blue/.test(t)?'#275d9b':'#6d6256';
    const o=pl.get(m.originPlaceId),d=pl.get(m.destinationPlaceId),end=m.endYear??m.startYear;
    added.push({id:m.id,sheetArrow:true,contested:/^Dotted/i.test(t),color,title:`${o.historicalName||m.origin} to ${d.historicalName||m.destination}`,date:m.dateDisplay,dateRange:{start:m.startYear,end},origin:m.originPlaceId,destination:m.destinationPlaceId,originCoordinates:a,destinationCoordinates:b,rendering:{control},movementType:null,evidenceStatus:'',story:'',sourceIds:[]});
    if(m.eventId&&S.cards.some(c=>c.id===m.eventId)){DATA.cardLinks=DATA.cardLinks||{};DATA.cardLinks[m.id]=m.eventId;}
  }
  DATA.movements=DATA.movements.concat(added);
}
// Eras 4-7 and the camera from 200 CE come from the Sheet (Eras, Camera Stops, Era Assignment tabs). The loader has already turned each
// stop's frame into a zoom (viewDeg); Eras 1-3 and the camera before 200 CE are untouched. Add ?engine=1 to see the old behaviour.
let ERA_OF=new Map(),ERA_NAME=new Map();
function addSheetEras(){
  const S=DATA.sheet;if(!S?.eras?.length||/[?&]engine=1/.test(location.search))return;
  ERA_NAME=new Map(S.eras.map(e=>[e.era,e.name]));ERA_OF=new Map((S.eraAssignment||[]).map(a=>[a.id,a.era]));
  DATA.eras=DATA.eras.concat(S.eras.filter(e=>e.era>=4&&e.status==='approved').sort((a,b)=>a.startYear-b.startYear).map(e=>({startDate:e.startYear,title:e.name})));
  const stops=(S.cameraStops||[]).filter(s=>s.status==='approved');if(!stops.length)return;
  const st=DATA.cameraStates,last=st[st.length-1],T=10,xy=(lon,lat)=>[(lon+15)*15,(58-lat)*650/53];
  const mk=(s,y)=>{const [cx,cy]=xy(s.centerLon,s.centerLat);return {startDate:y,scale:26/s.viewDeg,translateX:0,translateY:0,scope:s.label,centerX:cx,centerY:cy};};
  const add=[];if(last.startDate<stops[0].startYear-30)add.push({...last,startDate:stops[0].startYear-30});   // keep the antiquity view until 30 years before the first stop
  stops.forEach((s,i)=>{add.push(mk(s,s.startYear));const n=stops[i+1];if(n&&n.startYear-s.startYear>T)add.push(mk(s,n.startYear-T));});   // hold each view, then move to the next one over its last 10 years
  DATA.cameraStates=st.concat(add);
}
// From 200 CE the era label of an open card follows the Era Assignment tab (a card on a boundary year closes the earlier era); otherwise by year.
function eraLabel(y,frame){const r=selected?.record;if(r&&ERA_OF.size){const m=milestones.find(k=>k.record===r),e=m&&Math.round(y)===m.date&&m.date>=200?ERA_OF.get(r.id):null;if(e>=3&&ERA_NAME.has(e))return ERA_NAME.get(e);}return frame.era?.title||'';}
async function boot(){
  try{
    const res=await fetch('data/history.json');DATA=plainCEDeep(await res.json());try{GEO=await (await fetch('data/geo.json')).json();}catch(_){GEO=null;}assertHistory(DATA);addSheetMovements();addSheetEras();$('arcSlider').setAttribute('aria-valuemin',DATA.timeline.start);$('arcSlider').setAttribute('aria-valuemax',DATA.timeline.end);INDEX=indexData(DATA);
    buildTimeline();buildMilestones();initGL();initInteraction();
    position=posForYear(DATA.presentation?.openingYear??-1208);$('version').textContent='v'+APP_VERSION+' · Globe preview · data from Sheet '+(((DATA.sheet?.meta?.source||'').match(/v\d+(?:\.\d+)+/)||[])[0]||DATA.presentation?.version||'Alpha');
    layout();
  }catch(err){$('error').hidden=false;$('error').textContent='The map could not load: '+err.message;console.error(err);}
}
boot();
